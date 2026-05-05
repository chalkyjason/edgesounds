# Generates the EdgeSounds starter library:
#   - 9 TTS voice callouts (Windows System.Speech)
#   - 6 synthesized tones (raw PCM written directly)
# All output: 32 kHz mono 16-bit PCM .wav (EdgeTX-compatible).
# Re-run any time after editing the prompts/tones at the bottom.

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech

$root = Split-Path -Parent $PSScriptRoot
$soundsDir = Join-Path $root 'public\sounds'
$calloutsDir = Join-Path $soundsDir 'callouts'
$warningsDir = Join-Path $soundsDir 'warnings'
$memesDir = Join-Path $soundsDir 'memes'
foreach ($d in @($calloutsDir, $warningsDir, $memesDir)) {
  if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d | Out-Null }
}

# ---------- WAV writer (32 kHz mono 16-bit PCM) ----------
function Write-Wav {
  param([string]$Path, [Int16[]]$Samples, [int]$SampleRate = 32000)
  $byteCount = $Samples.Length * 2
  $fs = [System.IO.File]::Open($Path, [System.IO.FileMode]::Create)
  $bw = New-Object System.IO.BinaryWriter($fs)
  try {
    $bw.Write([System.Text.Encoding]::ASCII.GetBytes('RIFF'))
    $bw.Write([int32](36 + $byteCount))
    $bw.Write([System.Text.Encoding]::ASCII.GetBytes('WAVE'))
    $bw.Write([System.Text.Encoding]::ASCII.GetBytes('fmt '))
    $bw.Write([int32]16)             # PCM subchunk size
    $bw.Write([int16]1)              # PCM format
    $bw.Write([int16]1)              # mono
    $bw.Write([int32]$SampleRate)
    $bw.Write([int32]($SampleRate * 2))  # byte rate
    $bw.Write([int16]2)              # block align
    $bw.Write([int16]16)             # bits per sample
    $bw.Write([System.Text.Encoding]::ASCII.GetBytes('data'))
    $bw.Write([int32]$byteCount)
    foreach ($s in $Samples) { $bw.Write([int16]$s) }
  } finally {
    $bw.Dispose(); $fs.Dispose()
  }
}

function Clamp-Int16 {
  param([double]$v)
  if ($v -gt 32767) { return 32767 }
  if ($v -lt -32768) { return -32768 }
  return [int16]$v
}

# Mix multiple voices and an envelope. $voices is an array of @{f=...; w='sine'|'square'|'sawtooth'; vol=...}
# $env is a function that takes 0..1 t-progress and returns 0..1 amplitude multiplier.
function Synthesize {
  param(
    [int]$DurationMs,
    [array]$Voices,
    [scriptblock]$Envelope,
    [int]$SampleRate = 32000,
    [double]$MasterGain = 0.78
  )
  $n = [int]([Math]::Round($DurationMs / 1000.0 * $SampleRate))
  $out = New-Object 'System.Int16[]' $n
  for ($i = 0; $i -lt $n; $i++) {
    $t = $i / [double]$SampleRate
    $progress = $i / [double]$n
    $env = & $Envelope $progress
    $sum = 0.0
    foreach ($v in $Voices) {
      $f = $v.f
      $vol = $v.vol
      $phase = 2.0 * [Math]::PI * $f * $t
      switch ($v.w) {
        'square'    { $val = if ([Math]::Sin($phase) -ge 0) { 1.0 } else { -1.0 } }
        'sawtooth'  { $val = 2.0 * (($f * $t) - [Math]::Floor(0.5 + $f * $t)) }
        'triangle'  { $val = 2.0 / [Math]::PI * [Math]::Asin([Math]::Sin($phase)) }
        default     { $val = [Math]::Sin($phase) }
      }
      $sum += $val * $vol
    }
    $sample = $sum * $env * $MasterGain * 32767.0
    $out[$i] = Clamp-Int16 $sample
  }
  return ,$out
}

# Common envelopes
$envFastAttackSlowDecay = { param($t) [Math]::Exp(-3.5 * $t) }
$envSlowAttackDecay     = { param($t) ([Math]::Sin([Math]::PI * $t)) }
$envPercussive          = { param($t) [Math]::Exp(-7.0 * $t) }
$envHardCut             = { param($t) if ($t -lt 0.95) { 1.0 } else { (1.0 - $t) / 0.05 } }
$envBell                = { param($t) [Math]::Exp(-4.0 * $t) }

Write-Host "Generating synth tones..." -ForegroundColor Cyan

# boom.wav — sub-bass thump (vine-boom-alike, original)
$boom = Synthesize -DurationMs 900 -Envelope $envPercussive -Voices @(
  @{ f = 60;  w = 'sine'; vol = 0.9 },
  @{ f = 30;  w = 'sine'; vol = 0.7 },
  @{ f = 90;  w = 'sine'; vol = 0.3 }
)
Write-Wav -Path (Join-Path $memesDir 'boom.wav') -Samples $boom

# horn.wav — three-note chord blast (airhorn-alike)
$horn = Synthesize -DurationMs 1400 -Envelope $envHardCut -MasterGain 0.55 -Voices @(
  @{ f = 440; w = 'sawtooth'; vol = 0.5 },
  @{ f = 554; w = 'sawtooth'; vol = 0.4 },
  @{ f = 659; w = 'sawtooth'; vol = 0.4 },
  @{ f = 880; w = 'square';   vol = 0.2 }
)
Write-Wav -Path (Join-Path $memesDir 'horn.wav') -Samples $horn

# win.wav — achievement chime (C5 -> E5 -> G5 ascending)
function Concat-Samples {
  param([array]$Chunks)
  $total = 0; foreach ($c in $Chunks) { $total += $c.Length }
  $out = New-Object 'System.Int16[]' $total
  $offset = 0
  foreach ($c in $Chunks) {
    [Array]::Copy($c, 0, $out, $offset, $c.Length)
    $offset += $c.Length
  }
  return ,$out
}

$win1 = Synthesize -DurationMs 180 -Envelope $envBell -Voices @(@{ f = 523.25; w = 'triangle'; vol = 0.7 }, @{ f = 1046.5; w = 'sine'; vol = 0.25 })
$win2 = Synthesize -DurationMs 180 -Envelope $envBell -Voices @(@{ f = 659.25; w = 'triangle'; vol = 0.7 }, @{ f = 1318.5; w = 'sine'; vol = 0.25 })
$win3 = Synthesize -DurationMs 380 -Envelope $envBell -Voices @(@{ f = 783.99; w = 'triangle'; vol = 0.8 }, @{ f = 1568.0; w = 'sine'; vol = 0.3 })
$win = Concat-Samples -Chunks @($win1, $win2, $win3)
Write-Wav -Path (Join-Path $warningsDir 'win.wav') -Samples $win

# fail.wav — sad trombone (descending, slightly detuned)
$fail1 = Synthesize -DurationMs 220 -Envelope $envSlowAttackDecay -Voices @(@{ f = 261.6; w = 'sawtooth'; vol = 0.7 }, @{ f = 263; w = 'sawtooth'; vol = 0.3 })
$fail2 = Synthesize -DurationMs 220 -Envelope $envSlowAttackDecay -Voices @(@{ f = 246.94; w = 'sawtooth'; vol = 0.7 }, @{ f = 248; w = 'sawtooth'; vol = 0.3 })
$fail3 = Synthesize -DurationMs 220 -Envelope $envSlowAttackDecay -Voices @(@{ f = 220; w = 'sawtooth'; vol = 0.7 }, @{ f = 221.5; w = 'sawtooth'; vol = 0.3 })
$fail4 = Synthesize -DurationMs 600 -Envelope $envFastAttackSlowDecay -Voices @(@{ f = 196; w = 'sawtooth'; vol = 0.8 }, @{ f = 197.2; w = 'sawtooth'; vol = 0.4 })
$fail = Concat-Samples -Chunks @($fail1, $fail2, $fail3, $fail4)
Write-Wav -Path (Join-Path $warningsDir 'fail.wav') -Samples $fail

# bzzt.wav — error buzz (low square)
$bzzt = Synthesize -DurationMs 350 -Envelope $envHardCut -MasterGain 0.55 -Voices @(
  @{ f = 200; w = 'square'; vol = 0.7 },
  @{ f = 100; w = 'square'; vol = 0.3 }
)
Write-Wav -Path (Join-Path $warningsDir 'bzzt.wav') -Samples $bzzt

# ping.wav — notification bell (sine + harmonic, fast decay)
$ping = Synthesize -DurationMs 600 -Envelope $envBell -Voices @(
  @{ f = 880;  w = 'sine'; vol = 0.6 },
  @{ f = 1760; w = 'sine'; vol = 0.25 },
  @{ f = 2640; w = 'sine'; vol = 0.1 }
)
Write-Wav -Path (Join-Path $warningsDir 'ping.wav') -Samples $ping

# ---------- TTS callouts ----------
Write-Host "Generating TTS callouts..." -ForegroundColor Cyan

$callouts = @(
  @{ name = 'armed';   text = 'Motors armed' },
  @{ name = 'dsarmd';  text = 'Disarmed' },
  @{ name = 'battlw';  text = 'Battery low' },
  @{ name = 'thrwrn';  text = 'Throttle warning' },
  @{ name = 'swtwrn';  text = 'Switch warning' },
  @{ name = 'inacti';  text = 'Radio inactivity' },
  @{ name = 'telemok'; text = 'Telemetry recovered' },
  @{ name = 'tellst';  text = 'Telemetry lost' },
  @{ name = 'lowbat';  text = 'Transmitter battery low' }
)

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  # Prefer Zira (clearer in dark cockpit audio); fall back to David if missing.
  $voiceName = ($synth.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Name -like '*Zira*' } | Select-Object -First 1).VoiceInfo.Name
  if (-not $voiceName) { $voiceName = $synth.GetInstalledVoices()[0].VoiceInfo.Name }
  $synth.SelectVoice($voiceName)
  $synth.Rate = 0          # 0 = neutral; -10 slow, +10 fast
  $synth.Volume = 100

  $format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(
    32000,
    [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,
    [System.Speech.AudioFormat.AudioChannel]::Mono
  )

  foreach ($c in $callouts) {
    $path = Join-Path $calloutsDir ("{0}.wav" -f $c.name)
    $synth.SetOutputToWaveFile($path, $format)
    $synth.Speak($c.text)
    $synth.SetOutputToNull()
    Write-Host "  $($c.name).wav  <-  '$($c.text)'"
  }
} finally {
  $synth.Dispose()
}

Write-Host "Done." -ForegroundColor Green
