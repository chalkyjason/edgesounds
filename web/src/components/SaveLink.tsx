import { useState } from 'react'
import type { ReactNode } from 'react'
import { useToast } from '../hooks/useToast'
import { isNativeApp } from '../platform/platform'
import { saveFile } from '../platform/saveFile'

interface SaveLinkProps {
  /** Where the file's bytes are: a static path or a `blob:` URL. */
  href: string
  filename: string
  className?: string
  children: ReactNode
  /** Browser only -- runs as the download starts, as on a plain anchor. */
  onClick?: () => void
}

/**
 * A download link. In a browser it is exactly the `<a download>` it replaces.
 * A web view ignores that attribute, so in the iPhone app it is a button that
 * opens the share sheet instead, and reports the outcome itself.
 */
export function SaveLink({ href, filename, className, children, onClick }: SaveLinkProps) {
  const { notify } = useToast()
  const [saving, setSaving] = useState(false)

  if (!isNativeApp()) {
    return (
      <a href={href} download={filename} onClick={onClick} className={className}>
        {children}
      </a>
    )
  }

  const save = async () => {
    setSaving(true)
    try {
      const outcome = await saveFile(filename, href)
      if (outcome === 'saved') notify(`Saved ${filename}`, 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : `Could not save ${filename}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void save()}
      disabled={saving}
      className={[className, saving && 'opacity-60'].filter(Boolean).join(' ')}
    >
      {children}
    </button>
  )
}
