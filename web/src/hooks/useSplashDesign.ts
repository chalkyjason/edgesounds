import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { Pixel } from '../lib/mcm/types'
import { composeLayers, createPixelCache, layerExtent } from '../lib/emblem/compose'
import type { LayerPixels, MaskSources } from '../lib/emblem/compose'
import { EMPTY_DESIGN, imageLayer, isV1, migrateV1, newLayerId, placementToLayer, shapeLayer, textLayer } from '../lib/emblem/design'
import type { EmblemDesign, V1Design } from '../lib/emblem/design'
import { EMPTY_EDITOR, editorReducer } from '../lib/emblem/editor'
import type { LayerPatch, Reorder } from '../lib/emblem/editor'
import { MAX_LAYERS } from '../lib/emblem/types'
import type { DecodedImage, Layer } from '../lib/emblem/types'
import { fitInside } from '../lib/splash/image'
import type { Placement } from '../lib/splash/image'
import { applyPaint } from '../lib/splash/raster'
import type { Raster } from '../lib/splash/raster'
import type { Stencils } from '../lib/splash/stencils'
import { clearDesign, loadDesign, saveDesign } from '../utils/splashStorage'
import { useDebouncedSave } from './useDebouncedSave'
import { useShapeLibrary } from './useShapeLibrary'

const SAVE_DEBOUNCE_MS = 400

type ImageSource = EmblemDesign['image']

/** The decode result, tagged with the Blob it came from so a stale one is ignored. */
type ImageState = { source: Blob; result: { image: DecodedImage; placement: Placement } | { error: string } } | null

/**
 * The start screen: a stack of layers (shapes, text, the image) with paint
 * touch-ups on top. Undo covers layers and paint together; a gesture is one
 * step. The design is saved on change (debounced, flushed on leave) and a
 * design saved before layers is converted once what it needs has loaded.
 */
export function useSplashDesign(stencils: Stencils | null) {
  const library = useShapeLibrary()
  const [history, dispatch] = useReducer(editorReducer, EMPTY_EDITOR)
  const [imageSource, setImageSourceState] = useState<ImageSource>(EMPTY_DESIGN.image)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [storage, setStorage] = useState<'ok' | 'unavailable'>('ok')
  const [image, setImage] = useState<ImageState>(null)
  // A version-1 design waits here for the stencils (and its image) to convert.
  const [pendingV1, setPendingV1] = useState<V1Design | null>(null)
  const { layers, paint } = history.present

  // Restore.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const saved = await loadDesign()
        if (cancelled || !saved) return
        setImageSourceState({ source: saved.image.source, sourceName: saved.image.sourceName })
        if (isV1(saved)) setPendingV1(saved)
        else dispatch({ type: 'load', state: { layers: saved.layers, paint: saved.paint } })
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

  // Decode the image at its fitted size. Tagged with its source and read
  // during render, so this effect only sets state from async callbacks.
  const source = imageSource.source
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
        if (!cancelled) {
          setImage({ source, result: { image: { rgba: data, width: placement.width, height: placement.height }, placement } })
        }
      } catch (error) {
        if (!cancelled) {
          const detail = error instanceof Error ? ` (${error.message})` : ''
          setImage({ source, result: { error: `Could not read ${imageSource.sourceName ?? 'that image'}${detail}` } })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [source, imageSource.sourceName])

  const current = image && image.source === source ? image.result : null
  const decoded = current && 'image' in current ? current : null
  const imageError = current && 'error' in current ? current.error : null

  // Convert a version-1 design once its stencils, and its image if any, are in.
  const needsImage = pendingV1?.generator === 'image' && !!pendingV1.image.source
  if (pendingV1 && stencils && (!needsImage || decoded || imageError)) {
    setPendingV1(null)
    const design = migrateV1(pendingV1, stencils, decoded?.placement ?? null)
    dispatch({ type: 'load', state: { layers: design.layers, paint: design.paint } })
  }

  // Persist, debounced, once restored (so the empty default never overwrites a save).
  const toSave = useMemo<EmblemDesign>(
    () => ({ version: 2, layers, paint, image: imageSource }),
    [layers, paint, imageSource],
  )
  const persist = useCallback((value: EmblemDesign) => {
    saveDesign(value).catch((error: unknown) => {
      console.warn('[useSplashDesign] could not save the design', error)
      setStorage('unavailable')
    })
  }, [])
  useDebouncedSave(toSave, loaded && !pendingV1 && storage === 'ok', persist, SAVE_DEBOUNCE_MS)

  const sources = useMemo<MaskSources>(
    () => ({
      shapes: library.state === 'loaded' ? library.byId : null,
      stencils,
      image: decoded?.image ?? null,
    }),
    [library, stencils, decoded],
  )

  // One cache for the page's life: layers are immutable, so it keys on identity.
  const [pixelCache] = useState(createPixelCache)
  const pixelsOf = useCallback((layer: Layer): LayerPixels => pixelCache(layer, sources), [pixelCache, sources])

  const raster = useMemo<Raster>(() => applyPaint(composeLayers(layers, pixelsOf), paint), [layers, paint, pixelsOf])
  const extentOf = useCallback((layer: Layer) => layerExtent(layer, sources), [sources])

  const selected = layers.find((l) => l.id === selectedId) ?? null
  const canAdd = layers.length < MAX_LAYERS

  const add = useCallback((layer: Layer) => {
    dispatch({ type: 'add', layer })
    setSelectedId(layer.id)
  }, [])

  const addShape = useCallback((shape: string) => add(shapeLayer(shape)), [add])
  const addText = useCallback((font: 'big' | 'small') => add(textLayer('CALLSIGN', font)), [add])

  // Image layers waiting for the image to decode, to be fitted to the screen.
  const toFit = useRef(new Set<string>())

  /**
   * Use `file` as the design's image. With no image layer yet, add one; every
   * image layer is fitted to the new image once it has decoded.
   */
  const setImageFile = useCallback(
    (file: File) => {
      setImageSourceState({ source: file, sourceName: file.name })
      const existing = layers.filter((l) => l.kind === 'image')
      for (const layer of existing) toFit.current.add(layer.id)
      if (existing.length === 0) {
        const layer = imageLayer()
        toFit.current.add(layer.id)
        add(layer)
      }
    },
    [layers, add],
  )

  useEffect(() => {
    if (!decoded || toFit.current.size === 0) return
    for (const id of toFit.current) {
      if (layers.some((l) => l.id === id)) dispatch({ type: 'update', id, patch: placementToLayer(decoded.placement) })
    }
    toFit.current.clear()
  }, [decoded, layers])

  const update = useCallback((id: string, patch: LayerPatch) => dispatch({ type: 'update', id, patch }), [])
  const nudge = useCallback((id: string, dx: number, dy: number) => dispatch({ type: 'nudge', id, dx, dy }), [])
  const beginGesture = useCallback(() => dispatch({ type: 'begin' }), [])
  const endGesture = useCallback(() => dispatch({ type: 'end' }), [])
  const remove = useCallback((id: string) => {
    dispatch({ type: 'remove', id })
    setSelectedId((s) => (s === id ? null : s))
  }, [])
  const duplicate = useCallback((id: string) => {
    const newId = newLayerId()
    dispatch({ type: 'duplicate', id, newId })
    setSelectedId(newId)
  }, [])
  const move = useCallback((id: string, to: Reorder) => dispatch({ type: 'move', id, to }), [])
  const replaceLayers = useCallback((next: Layer[]) => {
    dispatch({ type: 'replace', layers: next })
    setSelectedId(next.at(-1)?.id ?? null)
  }, [])

  const stroke = useCallback((x: number, y: number, size: 1 | 2 | 3, color: Pixel) => {
    dispatch({ type: 'paint', x, y, size, color })
  }, [])
  const clearPaint = useCallback(() => dispatch({ type: 'clearPaint' }), [])
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])

  const reset = useCallback(async () => {
    dispatch({ type: 'load', state: { layers: [], paint: {} } })
    setImageSourceState(EMPTY_DESIGN.image)
    setSelectedId(null)
    try {
      await clearDesign()
    } catch (error) {
      console.warn('[useSplashDesign] could not clear the saved design', error)
    }
  }, [])

  return {
    loaded,
    storage,
    raster,
    layers,
    paint,
    selected,
    select: setSelectedId,
    pixelsOf,
    extentOf,
    sources,
    library,
    imageName: imageSource.sourceName,
    imageReady: decoded !== null,
    imageError,
    canAdd,
    addShape,
    addText,
    setImageFile,
    update,
    nudge,
    beginGesture,
    endGesture,
    remove,
    duplicate,
    move,
    replaceLayers,
    stroke,
    beginStroke: beginGesture,
    endStroke: endGesture,
    clearPaint,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    reset,
  }
}

export type SplashEditor = ReturnType<typeof useSplashDesign>
