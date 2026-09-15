import type { TriggerPreset } from '../types'

/**
 * Filenames verified against EdgeTX's own sound pack
 * (github.com/EdgeTX/edgetx-sdcard-sounds → SOUNDS/en/SYSTEM) and the firmware's
 * LEN_FUNCTION_NAME = 8 in radio/src/dataconstants.h.
 *
 * `system` entries are played by the firmware itself and the name is NOT negotiable —
 * it must match exactly, and the file goes in /SOUNDS/<lang>/SYSTEM/.
 * `track` entries are ordinary sounds you bind to a switch with a Play Track Special
 * Function; the name is a convention, not a requirement, and they live in /SOUNDS/<lang>/.
 */
export const TRIGGER_PRESETS: TriggerPreset[] = [
  // --- Played automatically by EdgeTX (/SOUNDS/<lang>/SYSTEM/) ---
  {
    id: 'hello',
    filename: 'hello',
    label: 'Radio startup',
    description: 'Plays when the radio boots',
    kind: 'system',
  },
  {
    id: 'inactiv',
    filename: 'inactiv',
    label: 'Inactivity alarm',
    description: 'Radio left on without stick input',
    kind: 'system',
  },
  {
    id: 'lowbatt',
    filename: 'lowbatt',
    label: 'TX battery low',
    description: 'Transmitter battery below the warning threshold',
    kind: 'system',
  },
  {
    id: 'thralert',
    filename: 'thralert',
    label: 'Throttle warning',
    description: 'Throttle not at zero on power-up',
    kind: 'system',
  },
  {
    id: 'swalert',
    filename: 'swalert',
    label: 'Switch warning',
    description: 'Switch not in its start position on power-up',
    kind: 'system',
  },
  {
    id: 'telemok',
    filename: 'telemok',
    label: 'Telemetry recovered',
    description: 'Telemetry link restored',
    kind: 'system',
  },
  {
    id: 'telemko',
    filename: 'telemko',
    label: 'Telemetry lost',
    description: 'Telemetry link dropped',
    kind: 'system',
  },
  {
    id: 'rxko',
    filename: 'rxko',
    label: 'RX connection lost',
    description: 'Receiver stopped responding',
    kind: 'system',
  },
  {
    id: 'rssi_red',
    filename: 'rssi_red',
    label: 'RSSI critical',
    description: 'Signal strength hit the red threshold',
    kind: 'system',
  },
  {
    id: 'rssi_org',
    filename: 'rssi_org',
    label: 'RSSI warning',
    description: 'Signal strength hit the orange threshold',
    kind: 'system',
  },

  // --- You bind these yourself (/SOUNDS/<lang>/ + a Play Track Special Function) ---
  {
    id: 'armed',
    filename: 'armed',
    label: 'On arm',
    description: 'Suggested name for an arm-switch callout',
    kind: 'track',
  },
  {
    id: 'dsarmd',
    filename: 'dsarmd',
    label: 'On disarm',
    description: 'Suggested name for a disarm callout',
    kind: 'track',
  },
  {
    id: 'battlw',
    filename: 'battlw',
    label: 'Flight battery low',
    description: 'Suggested name for a LiPo warning on a telemetry logical switch',
    kind: 'track',
  },
]

export const SYSTEM_PRESETS = TRIGGER_PRESETS.filter((p) => p.kind === 'system')
export const TRACK_PRESETS = TRIGGER_PRESETS.filter((p) => p.kind === 'track')
