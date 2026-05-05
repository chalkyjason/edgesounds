# Generates FPV-specific TTS callouts to public/sounds/flight/
# Output: 32 kHz mono 16-bit PCM .wav (EdgeTX-compatible).
# Voice: Microsoft Zira (en-US, female; falls back to David if absent).
#
# This is a sibling of scripts/generate-starter-library.ps1 — kept separate
# so re-running it doesn't disturb the existing TTS callouts.
#
# After running, the durations are printed; copy them into the matching
# entries you add to public/library.json under a "flight" category.

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech

$root = Split-Path -Parent $PSScriptRoot
$soundsDir = Join-Path $root 'public\sounds'
$flightDir = Join-Path $soundsDir 'flight'
if (-not (Test-Path $flightDir)) { New-Item -ItemType Directory -Path $flightDir | Out-Null }

# Edit this list to add/remove FPV phrases
$phrases = @(
  @{ name = 'crashd';  text = 'Crashed. Again.' },
  @{ name = 'gohome';  text = 'Returning home' },
  @{ name = 'punch';   text = 'Punch out' },
  @{ name = 'dive';    text = 'Diving' },
  @{ name = 'recon';   text = 'Recording on' },
  @{ name = 'recoff';  text = 'Recording off' },
  @{ name = 'acro';    text = 'Acro mode' },
  @{ name = 'angle';   text = 'Angle mode' },
  @{ name = 'horizn';  text = 'Horizon mode' },
  @{ name = 'failsf';  text = 'Failsafe' },
  @{ name = 'beeper';  text = 'Beeper on' },
  @{ name = 'turtle';  text = 'Turtle mode' }
)

# Read WAV duration after generation (System.Speech writes valid .wav with possible LIST chunk)
function Get-WavDuration {
  param([string]$Path)
  $bytes = [System.IO.File]::ReadAllBytes($Path)
  $sampleRate = [BitConverter]::ToInt32($bytes, 24)
  $channels = [BitConverter]::ToInt16($bytes, 22)
  $bps = [BitConverter]::ToInt16($bytes, 34)
  $i = 12
  $dataSize = 0
  while ($i -lt $bytes.Length - 8) {
    $id = [System.Text.Encoding]::ASCII.GetString($bytes, $i, 4)
    $sz = [BitConverter]::ToInt32($bytes, $i + 4)
    if ($id -eq 'data') { $dataSize = $sz; break }
    $i += 8 + $sz + ($sz % 2)
  }
  if ($dataSize -le 0) { return 0.0 }
  return [Math]::Round($dataSize / ($sampleRate * $channels * $bps / 8), 2)
}

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $voiceName = ($synth.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Name -like '*Zira*' } | Select-Object -First 1).VoiceInfo.Name
  if (-not $voiceName) { $voiceName = $synth.GetInstalledVoices()[0].VoiceInfo.Name }
  $synth.SelectVoice($voiceName)
  $synth.Rate = 0
  $synth.Volume = 100

  $format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(
    32000,
    [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,
    [System.Speech.AudioFormat.AudioChannel]::Mono
  )

  Write-Host "Generating FPV TTS callouts..." -ForegroundColor Cyan
  foreach ($p in $phrases) {
    $path = Join-Path $flightDir ("{0}.wav" -f $p.name)
    $synth.SetOutputToWaveFile($path, $format)
    $synth.Speak($p.text)
    $synth.SetOutputToNull()
    $dur = Get-WavDuration -Path $path
    Write-Host ("  {0,-8}  {1,4:N2}s  '{2}'" -f $p.name, $dur, $p.text)
  }
} finally {
  $synth.Dispose()
}

Write-Host ''
Write-Host 'Done.' -ForegroundColor Green
