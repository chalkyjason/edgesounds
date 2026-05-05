# Searches Myinstants for each curated query, picks the top result,
# and writes scripts/import-list.json ready for import-library.ps1.
#
# The query list at the bottom is meant to be edited — it's the curation step.
# After running this, eyeball the JSON, then run:
#     .\scripts\import-library.ps1
#
# Myinstants 403s default User-Agents, so we set a browser one here too.

[CmdletBinding()]
param(
  [string]$OutPath = (Join-Path $PSScriptRoot 'import-list.json'),
  [int]$ResultIndex = 0  # which search hit to use (0 = first)
)

$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)

$headers = @{
  'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36'
  'Accept'     = 'text/html,application/xhtml+xml'
}

function Resolve-FirstResult {
  param([string]$Query, [int]$Index = 0)
  $url = 'https://www.myinstants.com/en/search/?name=' + [uri]::EscapeDataString($Query)
  $r = Invoke-WebRequest -Uri $url -Headers $headers -UseBasicParsing -TimeoutSec 30
  $mp3Matches = [regex]::Matches($r.Content, '/media/sounds/([^"''<>\s]+\.mp3)')
  if ($mp3Matches.Count -le $Index) { return $null }
  $mp3 = 'https://www.myinstants.com' + $mp3Matches[$Index].Value

  # Title is usually inside <a class="instant-link" ...>TITLE</a>.
  # Best-effort regex; falls back to query if it can't find one.
  $titleMatches = [regex]::Matches(
    $r.Content,
    '<a[^>]+class="instant-link"[^>]*>\s*([^<]+?)\s*</a>'
  )
  $title = if ($titleMatches.Count -gt $Index) { $titleMatches[$Index].Groups[1].Value.Trim() } else { $Query }

  return @{ url = $mp3; title = $title }
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

# ---------- The curation list ----------
# Each row: query | category | edgetxName (<=6 chars) | id (slug)         | extra tags | trim end
$queries = @(
  @{ q='vine boom sound';         cat='memes';    edgetx='vboom';  id='meme-vine-boom';            tags=@('meme','boom','impact');                  trimEnd=2.5  },
  @{ q='mlg airhorn';             cat='memes';    edgetx='mlghrn'; id='meme-mlg-airhorn';          tags=@('meme','airhorn','mlg');                  trimEnd=2.5  },
  @{ q='bruh sound effect';       cat='memes';    edgetx='bruh';   id='meme-bruh';                 tags=@('meme','bruh');                           trimEnd=2.0  },
  @{ q='roblox oof';              cat='memes';    edgetx='oof';    id='meme-roblox-oof';           tags=@('meme','oof','roblox');                   trimEnd=1.5  },
  @{ q='discord notification';    cat='memes';    edgetx='disc';   id='meme-discord-ping';         tags=@('meme','discord','ping');                 trimEnd=1.5  },
  @{ q='nani';                    cat='memes';    edgetx='nani';   id='meme-nani';                 tags=@('meme','anime','nani');                   trimEnd=2.0  },
  @{ q='inconceivable princess';  cat='movies';   edgetx='incon';  id='movie-inconceivable';       tags=@('movie','princess-bride');                trimEnd=2.5  },
  @{ q='top gun need for speed';  cat='movies';   edgetx='need';   id='movie-need-for-speed';      tags=@('movie','top-gun','armed');               trimEnd=3.0  },
  @{ q='wilhelm scream';          cat='movies';   edgetx='scream'; id='movie-wilhelm-scream';      tags=@('movie','scream','wilhelm');              trimEnd=2.0  },
  @{ q='i love lamp';             cat='movies';   edgetx='lamp';   id='movie-i-love-lamp';         tags=@('movie','anchorman');                     trimEnd=2.5  },
  @{ q='thats what she said';     cat='tv';       edgetx='twss';   id='tv-thats-what-she-said';    tags=@('tv','office','michael');                 trimEnd=2.5  },
  @{ q='parkour office';          cat='tv';       edgetx='parkur'; id='tv-parkour';                tags=@('tv','office','parkour');                 trimEnd=2.5  },
  @{ q='bazinga';                 cat='tv';       edgetx='bazing'; id='tv-bazinga';                tags=@('tv','big-bang-theory');                  trimEnd=2.0  },
  @{ q='wubba lubba dub dub';     cat='tv';       edgetx='wubba';  id='tv-wubba-lubba';            tags=@('tv','rick-and-morty');                   trimEnd=2.5  },
  @{ q='xbox achievement';        cat='games';    edgetx='xbox';   id='game-xbox-achievement';     tags=@('game','xbox','achievement');             trimEnd=2.0  },
  @{ q='mario coin';              cat='games';    edgetx='coin';   id='game-mario-coin';           tags=@('game','mario','coin','retro');           trimEnd=1.5  },
  @{ q='mario jump';              cat='games';    edgetx='jump';   id='game-mario-jump';           tags=@('game','mario','retro');                  trimEnd=1.5  },
  @{ q='halo theme';              cat='games';    edgetx='halo';   id='game-halo-theme';           tags=@('game','halo');                           trimEnd=3.0  },
  @{ q='skyrim level up';         cat='games';    edgetx='lvlup';  id='game-skyrim-level-up';      tags=@('game','skyrim','level');                 trimEnd=3.0  },
  @{ q='aviation pull up';        cat='warnings'; edgetx='pullup'; id='warn-pull-up';              tags=@('warning','aviation','pull-up');          trimEnd=2.5  }
)

# ---------- Resolve each ----------
Write-Host "Resolving $($queries.Count) clips from Myinstants..." -ForegroundColor Cyan

$results = @()
$skipped = @()
$idx = 0
foreach ($it in $queries) {
  $idx++
  $label = "[{0,2}/{1}] {2,-30}" -f $idx, $queries.Count, $it.q
  Write-Host -NoNewline "$label  "
  try {
    $hit = Resolve-FirstResult -Query $it.q -Index $ResultIndex
    if (-not $hit) { Write-Host 'no results' -ForegroundColor Yellow; $skipped += $it.q; continue }
    $entry = [ordered]@{
      id          = $it.id
      category    = $it.cat
      edgetxName  = $it.edgetx
      displayName = $hit.title
      tags        = @($it.tags)
      url         = $hit.url
      credit      = ('via Myinstants ({0})' -f $hit.title)
      license     = 'fair-use-personal'
      trim        = @{ start = 0; end = $it.trimEnd }
    }
    $results += $entry
    Write-Host ('OK  {0}' -f $hit.url) -ForegroundColor Green
  } catch {
    Write-Host ('FAIL  {0}' -f $_.Exception.Message) -ForegroundColor Red
    $skipped += $it.q
  }
  Start-Sleep -Milliseconds 250  # be polite
}

# ---------- Write import-list.json (clean indent) ----------
function Write-Json {
  param($value, [int]$depth = 0)
  $pad  = ' ' * ($depth * 2)
  $ipad = ' ' * (($depth + 1) * 2)
  if ($null -eq $value) { return 'null' }
  if ($value -is [bool])    { if ($value) { return 'true' } else { return 'false' } }
  if ($value -is [int] -or $value -is [long]) { return $value.ToString([System.Globalization.CultureInfo]::InvariantCulture) }
  if ($value -is [double] -or $value -is [single] -or $value -is [decimal]) {
    return $value.ToString([System.Globalization.CultureInfo]::InvariantCulture)
  }
  if ($value -is [string]) { return Format-JsonString $value }
  if ($value -is [System.Collections.IList]) {
    if ($value.Count -eq 0) { return '[]' }
    $stringsOnly = $true; foreach ($x in $value) { if ($x -isnot [string]) { $stringsOnly = $false; break } }
    if ($stringsOnly) {
      $inline = ($value | ForEach-Object { Format-JsonString $_ }) -join ', '
      $candidate = "[$inline]"
      if ($candidate.Length -le 100) { return $candidate }
    }
    $items = $value | ForEach-Object { $ipad + (Write-Json $_ ($depth + 1)) }
    return "[`n" + ($items -join ",`n") + "`n" + $pad + ']'
  }
  if ($value -is [System.Collections.IDictionary]) {
    if ($value.Count -eq 0) { return '{}' }
    $items = foreach ($k in $value.Keys) {
      $ipad + (Format-JsonString $k.ToString()) + ': ' + (Write-Json $value[$k] ($depth + 1))
    }
    return "{`n" + ($items -join ",`n") + "`n" + $pad + '}'
  }
  return Format-JsonString ($value.ToString())
}

$json = Write-Json $results 0
[System.IO.File]::WriteAllText($OutPath, $json + "`n", $utf8)

Write-Host ''
Write-Host "Wrote $($results.Count) entries to $OutPath" -ForegroundColor Cyan
if ($skipped.Count -gt 0) {
  Write-Host "Skipped: $($skipped -join ', ')" -ForegroundColor Yellow
}
