import type { LineReport } from '../../lib/splash/template'
import { RASTER_WIDTH } from '../../lib/splash/raster'
import type { SplashEditor } from '../../hooks/useSplashDesign'

const INPUT =
  'w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm uppercase text-zinc-100 outline-none focus:border-accent'

/** Two centred lines in the stencil letters, rules on or off -- today's splash layout. */
export function TextTemplatePanel({ editor }: { editor: SplashEditor }) {
  const { text } = editor.design
  return (
    <div className="space-y-4">
      <Line
        id="splash-big"
        label="Big line"
        hint="14 px stencil, tile row 1"
        value={text.big}
        report={editor.report.big}
        onChange={(big) => editor.setText({ big })}
      />
      <Line
        id="splash-small"
        label="Small line"
        hint="9 px stencil, tile row 2"
        value={text.small}
        report={editor.report.small}
        onChange={(small) => editor.setText({ small })}
      />
      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input
          type="checkbox"
          checked={text.rules}
          onChange={(event) => editor.setText({ rules: event.target.checked })}
          className="h-4 w-4 accent-accent"
        />
        Rules above and below
      </label>
    </div>
  )
}

function Line({
  id,
  label,
  hint,
  value,
  report,
  onChange,
}: {
  id: string
  label: string
  hint: string
  value: string
  report: LineReport
  onChange: (value: string) => void
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm text-zinc-300">
        {label} <span className="text-xs text-zinc-500">· {hint}</span>
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={INPUT}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
      />
      <p className="mt-1 font-mono text-xs" aria-live="polite">
        {report.overflow > 0 ? (
          <span className="text-red-400">
            {report.overflow} px too wide — not drawn
          </span>
        ) : (
          <span className="text-zinc-500">
            {report.width} of {RASTER_WIDTH} px
          </span>
        )}
        {report.unsupported.length > 0 && (
          <span className="ml-2 text-amber-400">
            no stencil for {report.unsupported.map((c) => `"${c}"`).join(' ')}
          </span>
        )}
      </p>
    </div>
  )
}
