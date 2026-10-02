import { useShapeLibrary } from '../hooks/useShapeLibrary'
import { isNativeApp } from '../platform/platform'

/** Who made what. The CC BY 3.0 shapes require this attribution. */
export function Credits() {
  const library = useShapeLibrary()

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50">Credits</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Army Jay is open source under the MIT licence. These are the people and projects whose work it uses.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-zinc-100">Start screen shapes</h2>
        {library.state === 'loading' && <p className="text-sm text-zinc-500">Loading…</p>}
        {library.state === 'error' && (
          <p className="text-sm text-red-400">
            {library.message}{' '}
            <button type="button" onClick={library.retry} className="underline">
              Try again
            </button>
          </p>
        )}
        {library.state === 'loaded' && (
          <ul className="space-y-3">
            {library.library.packs.map((pack) => {
              const shapes = library.library.shapes.filter((s) => s.pack === pack.id)
              const byAuthor = new Map<string, string[]>()
              for (const shape of shapes) {
                if (!shape.author) continue
                byAuthor.set(shape.author, [...(byAuthor.get(shape.author) ?? []), shape.name])
              }
              return (
                <li key={pack.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-sm">
                  <p className="font-medium text-zinc-100">
                    {pack.name} <span className="font-normal text-zinc-500">· {shapes.length} shapes</span>
                  </p>
                  <p className="mt-1 text-zinc-400">
                    By {pack.author} ·{' '}
                    <a href={pack.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                      {pack.url.replace(/^https?:\/\//, '')}
                    </a>{' '}
                    ·{' '}
                    {pack.licenseUrl ? (
                      <a href={pack.licenseUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                        {pack.license}
                      </a>
                    ) : (
                      pack.license
                    )}
                  </p>
                  {byAuthor.size > 0 && (
                    <details className="mt-2 text-xs text-zinc-500">
                      <summary className="cursor-pointer text-zinc-400">Every shape and its author</summary>
                      {[...byAuthor].map(([author, names]) => (
                        <p key={author} className="mt-1">
                          <span className="text-zinc-300">{author}:</span> {names.join(', ')}
                        </p>
                      ))}
                      <p className="mt-1">Background square removed; otherwise as published.</p>
                    </details>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <p className="text-xs text-zinc-500">
          Symbols: Tabler Icons, MIT licence, Copyright (c) 2020-2026 Paweł Kuna. Permission is hereby granted, free of
          charge, to any person obtaining a copy of this software and associated documentation files, to deal in the
          Software without restriction, subject to including this notice in all copies or substantial portions of the
          Software.
        </p>
      </section>

      <section className="space-y-2 text-sm text-zinc-400">
        <h2 className="text-lg font-medium text-zinc-100">Everything else</h2>
        <p>The Army Jay fonts, stencil letters and the Basics, Insignia and FPV shapes: Army Jay, MIT.</p>
        <p>Interface icons: Lucide, ISC licence.</p>
        {!isNativeApp() && (
          <>
            <p>Audio conversion on this site: ffmpeg.wasm (ffmpeg, GPL).</p>
            <p>Betaflight&apos;s default font, offered as an export base: Betaflight Configurator, GPL-3.0.</p>
          </>
        )}
      </section>
    </div>
  )
}
