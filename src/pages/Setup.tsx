import { TRIGGER_PRESETS } from '../utils/triggerPresets'

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
            Open the radio's drive. Navigate to{' '}
            <code className="font-mono text-zinc-200">/SOUNDS/&lt;language&gt;/</code> — for English
            this is <code className="font-mono text-zinc-200">/SOUNDS/en/</code>.
          </li>
          <li>Drop your <code className="font-mono">.wav</code> files in.</li>
          <li>Eject the drive cleanly, unplug, and reboot the radio.</li>
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-100">Auto-trigger filenames</h2>
        <p className="mt-2 text-sm text-zinc-400">
          EdgeTX plays a sound automatically when you name it exactly right. The filename is the
          contract — don't add prefixes, don't add spaces, don't go over 6 characters.
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
              {TRIGGER_PRESETS.map((p) => (
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
          For sounds you want a switch to trigger (instead of one of the built-in events):
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
            <strong>Filename longer than 6 chars:</strong> EdgeTX silently ignores it. Always trim
            (the converter does this automatically).
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
