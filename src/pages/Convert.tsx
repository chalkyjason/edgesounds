import { Converter } from '../components/Converter'

export function Convert() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">Converter</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Drop in any audio file. We'll re-encode it to 32 kHz mono 16-bit PCM and hand you back a{' '}
          <span className="font-mono text-zinc-300">.wav</span> EdgeTX will accept on the first try.
        </p>
      </div>
      <Converter />
    </div>
  )
}
