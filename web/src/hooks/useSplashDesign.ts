import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import type { Pixel } from '../lib/mcm/types'
import { fitInside, rasterizeImage } from '../lib/splash/image'
import type { ImageOptions, Placement } from '../lib/splash/image'
import { EMPTY_HISTORY, paintReducer } from '../lib/splash/paint'
import { applyPaint, emptyRaster } from '../lib/splash/raster'
import type { Raster } from '../lib/splash/raster'
import type { Stencils } from '../lib/splash/stencils'
import { renderTemplate } from '../lib/splash/template'
import type { LineReport, TemplateInput } from '../lib/splash/template'
import { DEFAULT_DESIGN, clearDesign, loadDesign, saveDesign } from '../utils/splashStorage'
import type { SplashDesign } from '../utils/splashStorage'
import { useDebouncedSave } from './useDebouncedSave'

const SAVE_DEBOUNCE_MS = 400
const EMPTY_REPORT: LineReport = { width: 0, overflow: 0, unsupported: [], drawn: false }

interface DecodedImage {
  rgba: Uint8ClampedArray
  placement: Placement
}

/** The decode result, tagged with the Blob it came from so a stale one is ignored. */
type ImageState = { source: Blob; result: DecodedImage | { error: string } } | null

/**
 * The start-screen design: a generator (text template or image) that makes
 * the base raster, and a paint layer of pixel overrides on top -- the glyph
 * editor's base-plus-edits pattern, so changing the text later keeps the
 * touch-ups.
 *
 * The design is saved to IndexedDB on every change (debounced) and restored
 * on load; paint's undo history is not persisted. The decoded image pixels
 * are derived from the stored source file, not stored themselves.
 */
export function useSplashDesign(stencils: Stencils | null) {
  const [design, setDesign] = useState<Omit<SplashDesign, 'paint'>>(stripPaint(DEFAULT_DESIGN))
  const [paint, dispatch] = useReducer(paintReducer, EMPTY_HISTORY)
  const [loaded, setLoaded] = useState(false)
  const [storage, setStorage] = useState<'ok' | 'unavailable'>('ok')
  const [image, setImage] = useState<ImageState>(null)

  // Restore.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const saved = await loadDesign()
        if (cancelled) return
        if (saved) {
          setDesign(stripPaint(saved))
          dispatch({ type: 'load', paint: saved.paint })
        }
      } catch (error) {
        console.warn('[useSplashDesign] could not load the saved design', error)
        if (!cancelled) setStorage('unavailable')
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Persist, debounced, once restored (so the default never overwrites a save).
  const toSave = useMemo<SplashDesign>(() => ({ ...design, paint: paint.present }), [design, paint.present])
  const persist = useCallback((value: SplashDesign) => {
    saveDesign(value).catch((error: unknown) => {
      console.warn('[useSplashDesign] could not save the design', error)
      setStorage('unavailable')
    })
  }, [])
  useDebouncedSave(toSave, loaded && storage === 'ok', persist, SAVE_DEBOUNCE_MS)

  // Decode the image source into pixels at its fitted placement. The result
  // is tagged with its source and read during render, so this effect only
  // sets state from the async callbacks (see useFont for the same shape).
  const source = design.image.source
  useEffect(() => {
    if (!source) return
    let cancelled = false
    void (async () => {
      try {
        const bitmap = await createImageBitmap(source)
        const placement = fitInside(bitmap.width, bitmap.height)
        const canvas = document.createElement('canvas')
        canvas.width = placement.width
        canvas.height = placement.height
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) throw new Error('Could not get a 2D context')
        ctx.imageSmoothingEnabled = true
        ctx.drawImage(bitmap, 0, 0, placement.width, placement.height)
        bitmap.close()
        const { data } = ctx.getImageData(0, 0, placement.width, placement.height)
        if (!cancelled) setImage({ source, result: { rgba: data, placement } })
      } catch (error) {
        if (!cancelled) {
          const detail = error instanceof Error ? ` (${error.message})` : ''
          setImage({
            source,
            result: { error: `Could not read ${design.image.sourceName ?? 'that image'}${detail}` },
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [source, design.image.sourceName])

  const current = image && image.source === source ? image.result : null
  const decoded = current && 'rgba' in current ? current : null
  const imageError = current && 'error' in current ? current.error : null

  const template = useMemo(() => {
    if (design.generator !== 'text' || !stencils) return null
    return renderTemplate(stencils, design.text)
  }, [design.generator, design.text, stencils])

  const base = useMemo<Raster>(() => {
    if (design.generator === 'text') return template?.raster ?? emptyRaster()
    if (!decoded) return emptyRaster()
    const { source: _source, sourceName: _name, ...options } = design.image
    return rasterizeImage(decoded.rgba, decoded.placement, options)
  }, [design.generator, design.image, template, decoded])

  const raster = useMemo(() => applyPaint(base, paint.present), [base, paint.present])

  const setGenerator = useCallback((generator: SplashDesign['generator']) => {
    setDesign((d) => ({ ...d, generator }))
  }, [])
  const setText = useCallback((patch: Partial<TemplateInput>) => {
    setDesign((d) => ({ ...d, generator: 'text', text: { ...d.text, ...patch } }))
  }, [])
  const setImageOptions = useCallback((patch: Partial<ImageOptions>) => {
    setDesign((d) => ({ ...d, generator: 'image', image: { ...d.image, ...patch } }))
  }, [])
  const setImageSource = useCallback((file: File | null) => {
    setDesign((d) => ({
      ...d,
      generator: 'image',
      image: { ...d.image, source: file, sourceName: file?.name ?? null },
    }))
  }, [])
  const stroke = useCallback((x: number, y: number, size: 1 | 2 | 3, color: Pixel) => {
    dispatch({ type: 'stroke', x, y, size, color })
  }, [])
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])
  const clearPaint = useCallback(() => dispatch({ type: 'clear' }), [])
  const reset = useCallback(async () => {
    setDesign(stripPaint(DEFAULT_DESIGN))
    dispatch({ type: 'load', paint: {} })
    try {
      await clearDesign()
    } catch (error) {
      console.warn('[useSplashDesign] could not clear the saved design', error)
    }
  }, [])

  return {
    design,
    loaded,
    storage,
    raster,
    report: { big: template?.big ?? EMPTY_REPORT, small: template?.small ?? EMPTY_REPORT },
    imageError,
    imageReady: decoded !== null,
    paint: paint.present,
    canUndo: paint.past.length > 0,
    canRedo: paint.future.length > 0,
    setGenerator,
    setText,
    setImageOptions,
    setImageSource,
    stroke,
    undo,
    redo,
    clearPaint,
    reset,
  }
}

function stripPaint(design: SplashDesign): Omit<SplashDesign, 'paint'> {
  const { paint: _paint, ...rest } = design
  return rest
}

export type SplashEditor = ReturnType<typeof useSplashDesign>
