# Bulk-import audio clips for the EdgeSounds library.
#   1. Reads scripts/import-list.json (or path passed via -List)
#   2. Downloads each entry, converts to 32 kHz mono 16-bit PCM .wav (ffmpeg)
#   3. Writes the file to public/sounds/<category>/<id>.wav
#   4. Updates public/library.json (inserts new entries; replaces existing by id)
#
# Requires ffmpeg on PATH. Install once: winget install Gyan.FFmpeg
# Then restart the shell so PATH refreshes.
#
# Usage:
#   .\scripts\import-library.ps1
#   .\scripts\import-library.ps1 -List path\to\my-list.json
#   .\scripts\import-library.ps1 -DryRun        # validate only, no downloads/writes

[CmdletBinding()]
param(
  [string]$List = (Join-Path $PSScriptRoot 'import-list.json'),
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$publicDir = Join-Path $root 'public'
$soundsRoot = Join-Path $publicDir 'sounds'
$libraryPath = Join-Path $publicDir 'library.json'

# --- Pre-flight ----------------------------------------------------------------

function Find-Ffmpeg {
  $cmd = Get-Command ffmpeg -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $linksPath = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links\ffmpeg.exe'
  if (Test-Path $linksPath) { return $linksPath }
  $pkgRoot = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'
  if (Test-Path $pkgRoot) {
    $found = Get-ChildItem -Path $pkgRoot -Recurse -Filter 'ffmpeg.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { return $found.FullName }
  }
  return $null
}

$ffmpegExe = Find-Ffmpeg
if (-not $ffmpegExe) {
  Write-Host ''
  Write-Host 'ffmpeg not found.' -ForegroundColor Red
  Write-Host 'Install once with:'
  Write-Host '    winget install Gyan.FFmpeg' -ForegroundColor Yellow
  Write-Host 'Then re-run this script (no shell restart needed - it auto-locates the binary).'
  Write-Host ''
  exit 1
}
Write-Host "ffmpeg: $ffmpegExe" -ForegroundColor DarkGray

if (-not (Test-Path $List)) {
  Write-Host "Import list not found: $List" -ForegroundColor Red
  Write-Host "Copy scripts\import-list.example.json to scripts\import-list.json and edit." -ForegroundColor Yellow
  exit 1
}

if (-not (Test-Path $libraryPath)) {
  Write-Host "library.json not found at $libraryPath" -ForegroundColor Red
  exit 1
}

# --- Load inputs ---------------------------------------------------------------

$utf8 = New-Object System.Text.UTF8Encoding($false)

function Read-JsonFile {
  param([string]$Path)
  $text = [System.IO.File]::ReadAllText($Path, [System.Text.UTF8Encoding]::new($false))
  return $text | ConvertFrom-Json
}

$rawItems = Read-JsonFile $List
$items = @($rawItems | Where-Object { -not $_.PSObject.Properties['_comment'] -or $_.url -ne $null })

if (-not $items -or $items.Count -eq 0) {
  Write-Host 'Import list is empty.' -ForegroundColor Yellow
  exit 0
}

$library = Read-JsonFile $libraryPath
$catMap = @{}
foreach ($cat in $library.categories) { $catMap[$cat.id] = $cat }

# --- Helpers -------------------------------------------------------------------

function Assert-EdgetxName {
  param([string]$n)
  if (-not $n) { throw 'edgetxName is required' }
  if ($n.Length -gt 6) { throw "edgetxName '$n' exceeds the 6-char EdgeTX limit" }
  if ($n -cnotmatch '^[a-z0-9_]+$') { throw "edgetxName '$n' must be lowercase a-z 0-9 _ only" }
}

function Assert-Slug {
  param([string]$s)
  if (-not $s) { throw 'id is required' }
  if ($s -cnotmatch '^[a-z0-9-]+$') { throw "id '$s' must be lowercase a-z 0-9 - only" }
}

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

function Format-JsonString {
  param([string]$s)
  $sb = New-Object System.Text.StringBuilder
  $null = $sb.Append('"')
  foreach ($ch in $s.ToCharArray()) {
    $code = [int]$ch
    switch ($code) {
      8  { $null = $sb.Append('\b') }
      9  { $null = $sb.Append('\t') }
      10 { $null = $sb.Append('\n') }
      12 { $null = $sb.Append('\f') }
      13 { $null = $sb.Append('\r') }
      34 { $null = $sb.Append('\"') }
      92 { $null = $sb.Append('\\') }
      default {
        if ($code -lt 32) { $null = $sb.AppendFormat('\u{0:x4}', $code) }
        else { $null = $sb.Append($ch) }
      }
    }
  }
  $null = $sb.Append('"')
  return $sb.ToString()
}

function Format-JsonValue {
  param($value, [int]$depth = 0)
  $pad  = ' ' * ($depth * 2)
  $ipad = ' ' * (($depth + 1) * 2)
  if ($null -eq $value) { return 'null' }
  if ($value -is [bool])    { if ($value) { return 'true' } else { return 'false' } }
  if ($value -is [int] -or $value -is [long] -or $value -is [int16] -or $value -is [byte]) {
    return $value.ToString([System.Globalization.CultureInfo]::InvariantCulture)
  }
  if ($value -is [double] -or $value -is [single] -or $value -is [decimal]) {
    return $value.ToString([System.Globalization.CultureInfo]::InvariantCulture)
  }
  if ($value -is [string]) { return Format-JsonString $value }
  if ($value -is [System.Collections.IList]) {
    if ($value.Count -eq 0) { return '[]' }
    # Inline short string-only arrays (e.g. tags) for readability
    $stringsOnly = $true
    foreach ($x in $value) { if ($x -isnot [string]) { $stringsOnly = $false; break } }
    if ($stringsOnly) {
      $inline = ($value | ForEach-Object { Format-JsonString $_ }) -join ', '
      $candidate = "[$inline]"
      if ($candidate.Length -le 100) { return $candidate }
    }
    $items = $value | ForEach-Object { $ipad + (Format-JsonValue $_ ($depth + 1)) }
    return "[`n" + ($items -join ",`n") + "`n" + $pad + ']'
  }
  if ($value -is [System.Collections.IDictionary]) {
    if ($value.Count -eq 0) { return '{}' }
    $items = foreach ($k in $value.Keys) {
      $ipad + (Format-JsonString $k.ToString()) + ': ' + (Format-JsonValue $value[$k] ($depth + 1))
    }
    return "{`n" + ($items -join ",`n") + "`n" + $pad + '}'
  }
  if ($value.PSObject -and $value.PSObject.Properties) {
    $props = @($value.PSObject.Properties)
    if ($props.Count -eq 0) { return '{}' }
    $items = $props | ForEach-Object {
      $ipad + (Format-JsonString $_.Name) + ': ' + (Format-JsonValue $_.Value ($depth + 1))
    }
    return "{`n" + ($items -join ",`n") + "`n" + $pad + '}'
  }
  return Format-JsonString ($value.ToString())
}

function Build-FfmpegArgs {
  param($item, [string]$inPath, [string]$outPath)
  $a = @()
  if ($item.PSObject.Properties['trim'] -and $item.trim) {
    if ($null -ne $item.trim.start) { $a += @('-ss', ([double]$item.trim.start).ToString([System.Globalization.CultureInfo]::InvariantCulture)) }
    if ($null -ne $item.trim.end)   { $a += @('-to', ([double]$item.trim.end).ToString([System.Globalization.CultureInfo]::InvariantCulture)) }
  }
  $a += @('-i', $inPath, '-ar', '32000', '-ac', '1', '-sample_fmt', 's16', '-c:a', 'pcm_s16le', '-y', $outPath)
  return ,$a
}

# --- Main loop -----------------------------------------------------------------

$temp = New-Item -ItemType Directory -Path (Join-Path $env:TEMP "edgesounds-import-$(Get-Random)") -Force
$results = @()
$idx = 0

foreach ($item in $items) {
  $idx++
  $id = $item.id
  $label = "[$idx/$($items.Count)] $id"
  Write-Host "$label  " -NoNewline

  try {
    Assert-Slug $id
    Assert-EdgetxName $item.edgetxName
    if (-not $item.category) { throw 'category is required' }
    if (-not $catMap.ContainsKey($item.category)) {
      throw "category '$($item.category)' is not in library.json (add it first)"
    }
    if (-not $item.url -or $item.url -like 'https://example.com/*') {
      throw 'url is missing or still set to the example placeholder'
    }
    if (-not $item.displayName) { throw 'displayName is required' }

    $cat = $catMap[$item.category]
    $outDir = Join-Path $soundsRoot $item.category
    if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
    $outPath = Join-Path $outDir "$id.wav"

    if ($DryRun) {
      Write-Host "DRY-RUN  $($item.url) -> public/sounds/$($item.category)/$id.wav"
      continue
    }

    Write-Host 'downloading...' -NoNewline
    $tempInput = Join-Path $temp "input-$idx.bin"
    $headers = @{
      'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36'
      'Referer'    = 'https://www.myinstants.com/'
      'Accept'     = 'audio/*,*/*;q=0.5'
    }
    Invoke-WebRequest -Uri $item.url -OutFile $tempInput -Headers $headers -UseBasicParsing -TimeoutSec 60 | Out-Null

    $fi = Get-Item $tempInput
    if ($fi.Length -lt 256) {
      $head = [System.Text.Encoding]::ASCII.GetString([System.IO.File]::ReadAllBytes($tempInput))
      throw "downloaded file is suspiciously small ($($fi.Length) bytes). Head: $head"
    }

    Write-Host ' converting...' -NoNewline
    $ffArgs = Build-FfmpegArgs -item $item -inPath $tempInput -outPath $outPath
    $errFile = Join-Path $temp "ff-$idx.err"
    $outFile = Join-Path $temp "ff-$idx.out"
    $proc = Start-Process -FilePath $ffmpegExe -ArgumentList $ffArgs -NoNewWindow -Wait -PassThru `
              -RedirectStandardError $errFile -RedirectStandardOutput $outFile
    if ($proc.ExitCode -ne 0) {
      $err = if (Test-Path $errFile) { Get-Content $errFile -Raw } else { '' }
      throw "ffmpeg failed (exit $($proc.ExitCode)): $err"
    }

    $duration = Get-WavDuration -Path $outPath
    Write-Host (" {0}s OK" -f $duration) -ForegroundColor Green

    $entry = [ordered]@{
      id          = $id
      filename    = "$($item.edgetxName).wav"
      displayName = $item.displayName
      duration    = $duration
      tags        = @($item.tags)
      path        = "/sounds/$($item.category)/$id.wav"
    }
    if ($item.PSObject.Properties['trigger'] -and $item.trigger) { $entry['trigger'] = $item.trigger }
    if ($item.PSObject.Properties['credit']  -and $item.credit)  { $entry['credit']  = $item.credit }
    if ($item.PSObject.Properties['license'] -and $item.license) { $entry['license'] = $item.license }

    $existingFiltered = @($cat.sounds | Where-Object { $_.id -ne $id })
    $cat.sounds = @($existingFiltered + [pscustomobject]$entry)

    $results += @{ id = $id; status = 'ok'; duration = $duration }
  } catch {
    Write-Host ' FAILED' -ForegroundColor Red
    Write-Host "    $($_.Exception.Message)" -ForegroundColor DarkRed
    $results += @{ id = $id; status = 'failed'; error = $_.Exception.Message }
  }
}

if ($DryRun) {
  Write-Host ''
  Write-Host 'Dry run complete. No files changed.' -ForegroundColor Cyan
  Remove-Item -Recurse -Force $temp -ErrorAction SilentlyContinue
  exit 0
}

# --- Write library.json (only if something actually changed) -------------------

$ok = @($results | Where-Object { $_.status -eq 'ok' }).Count
$fail = @($results | Where-Object { $_.status -eq 'failed' }).Count

Write-Host ''
if ($ok -gt 0) {
  $json = Format-JsonValue $library 0
  [System.IO.File]::WriteAllText($libraryPath, $json + "`n", $utf8)
  Write-Host "Imported $ok / $($items.Count) entries.  ($fail failed)" -ForegroundColor Cyan
  Write-Host "Updated: $libraryPath"
} else {
  Write-Host "Imported 0 / $($items.Count) entries.  ($fail failed). library.json unchanged." -ForegroundColor Yellow
}

Remove-Item -Recurse -Force $temp -ErrorAction SilentlyContinue
