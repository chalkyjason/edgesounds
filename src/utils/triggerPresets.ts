import type { TriggerPreset } from '../types'

export const TRIGGER_PRESETS: TriggerPreset[] = [
  { id: 'armed', filename: 'armed', label: 'On Arm', description: 'Plays when motors arm' },
  { id: 'dsarmd', filename: 'dsarmd', label: 'On Disarm', description: 'Plays when motors disarm' },
  { id: 'battlw', filename: 'battlw', label: 'Battery Low', description: 'Battery low warning' },
  { id: 'thrwrn', filename: 'thrwrn', label: 'Throttle Warning', description: 'Throttle not at zero' },
  { id: 'swtwrn', filename: 'swtwrn', label: 'Switch Warning', description: 'Switch not in correct position' },
  { id: 'inacti', filename: 'inacti', label: 'Inactivity Alarm', description: 'Radio left on without input' },
  { id: 'telemok', filename: 'telemok', label: 'Telemetry OK', description: 'Telemetry recovered' },
  { id: 'tellst', filename: 'tellst', label: 'Telemetry Lost', description: 'Telemetry signal lost' },
  { id: 'lowbat', filename: 'lowbat', label: 'Radio Low Battery', description: 'Transmitter battery low' },
]
