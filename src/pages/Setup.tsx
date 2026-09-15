import { MAX_FILENAME_LENGTH } from '../utils/sanitizeFilename'
import { SYSTEM_PRESETS, TRACK_PRESETS } from '../utils/triggerPresets'

export function Setup() {
  return (
    <article className="prose-invert space-y-10 text-zinc-300">
      <header>
        <h1 className="text-3xl font-semibold text-zinc-50">EdgeTX Setup Guide</h1>
        <p className="mt-2 text-zinc-400">
          Get sounds onto your radio in under five minutes — or read the gotchas section first if it's
          your first time and avoid the silent failures.
        </p>
      </header>

      <section>
        <h2 className="text-xl font-semibold text-zinc-100">Quick start (USB)</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-300">
          <li>Power on the radio with USB plugged into your computer.</li>
          <li>
            From the radio menu, select <strong>USB Storage</strong> (not USB Joystick / Serial).
          </li>
          <li>
            Open the radio's drive and find{' '}
            <code className="font-mono text-zinc-200">/SOUNDS/&lt;language&gt;/</code> — for English
            this is <code className="font-mono text-zinc-200">/SOUNDS/en/</code>.
          </li>
          <li>
            Drop the file in the folder that matches what you want:{' '}
            <code className="font-mono text-zinc-200">/SOUNDS/en/SYSTEM/</code> if EdgeTX should
            play it automatically, or <code className="font-mono text-zinc-200">/SOUNDS/en/</code>{' '}
            if you'll trigger it yourself from a switch. Putting an automatic sound in the wrong
            folder is the single most common reason it never plays.
          </li>
          <li>Eject the drive cleanly, unplug, and reboot the radio.</li>
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-100">Auto-trigger filenames</h2>
        <p className="mt-2 text-sm text-zinc-400">
          These names are fixed by the firmware, not by convention — EdgeTX looks for these exact
          files and plays them itself. They belong in{' '}
          <code className="font-mono text-zinc-200">/SOUNDS/&lt;lang&gt;/SYSTEM/</code>. Don't add
          prefixes and don't rename them; a near-miss just stays silent.
        </p>
        <div className="mt-4 overflow-hidden rounded-lg border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/80 text-left text-xs uppercase tracking-wider text-zinc-400">
              <tr>
                <th className="px-3 py-2">Filename</th>
                <th className="px-3 py-2">Trigger</th>
                <th className="px-3 py-2">When it plays</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {SYSTEM_PRESETS.map((p) => (
                <tr key={p.id} className="bg-zinc-900/30">
                  <td className="px-3 py-2 font-mono text-zinc-200">{p.filename}.wav</td>
                  <td className="px-3 py-2">{p.label}</td>
                  <td className="px-3 py-2 text-zinc-400">{p.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-100">Special Functions (custom switches)</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Everything else — arm callouts, memes, movie lines — is an ordinary sound you bind
          yourself. The name is <em>your</em> choice here (up to {MAX_FILENAME_LENGTH} characters);
          these are just the conventions the library uses:{' '}
          {TRACK_PRESETS.map((p, i) => (
            <span key={p.id}>
              {i > 0 && ', '}
              <code className="font-mono text-zinc-300">{p.filename}.wav</code> ({p.label
                .toLowerCase()})
            </span>
          ))}
          .
        </p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-300">
          <li>
            Copy your <code className="font-mono">.wav</code> into{' '}
            <code className="font-mono">/SOUNDS/&lt;lang&gt;/</code>.
          </li>
          <li>
            On the radio, open <strong>Model Settings → Special Functions</strong>.
          </li>
          <li>Pick a free SF slot. Set the source to a switch position (e.g. SA↑).</li>
          <li>
            Set the action to <strong>Play Track</strong> and select your file.
          </li>
          <li>Optionally set a repeat interval. Save and flip the switch to test.</li>
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-100">Common gotchas</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-zinc-300">
          <li>
            <strong>Filename longer than {MAX_FILENAME_LENGTH} chars:</strong> EdgeTX stores the
            name in an {MAX_FILENAME_LENGTH}-character field (
            <code className="font-mono">LEN_FUNCTION_NAME</code>), so anything longer is silently
            ignored. The converter trims for you.
          </li>
          <li>
            <strong>Automatic sound in the wrong folder:</strong> a SYSTEM name only works from{' '}
            <code className="font-mono">/SOUNDS/&lt;lang&gt;/SYSTEM/</code>. Dropped in{' '}
            <code className="font-mono">/SOUNDS/&lt;lang&gt;/</code> it will never fire on its own —
            it just becomes a Play Track file you have to bind manually.
          </li>
          <li>
            <strong>Spaces or special characters:</strong> Same fate. ASCII letters, digits, and
            underscores only.
          </li>
          <li>
            <strong>Wrong sample rate:</strong> Anything above 32 kHz can play distorted or skip.
            32 kHz is the safe ceiling.
          </li>
          <li>
            <strong>Stereo file:</strong> Some radios refuse stereo. Always export mono.
          </li>
          <li>
            <strong>SD card formatting:</strong> FAT32 is the safest default. Most radios won't read
            exFAT or NTFS.
          </li>
          <li>
            <strong>Card not appearing in USB Storage mode:</strong> Make sure you selected USB
            Storage on the radio's USB prompt — Joystick mode hides the card.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-100">Tested radios</h2>
        <p className="mt-2 text-sm text-zinc-400">
          The format produced by EdgeSounds works on RadioMaster Boxer / Pocket / Zorro / TX16S,
          Jumper T-series, FrSky X-Lite / Tandem, and any other EdgeTX target running 2.8+. If you
          run into a radio that won't play it, file an issue on the repo and we'll dig in.
        </p>
      </section>
    </article>
  )
}
