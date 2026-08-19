<#
  One-click kiosk launcher: starts the booth server, then opens the booth UI
  fullscreen on the primary display and the camera mirror on the second
  (skipped when only one display is connected).

  Switches: -SwapMonitors (swap displays), -Dev (npm run dev), -Port <n> (default 3000).
#>

param(
  [int]$Port = 3000,
  [switch]$SwapMonitors,
  [switch]$Dev
)

$ErrorActionPreference = "Stop"
$projectDir = $PSScriptRoot
$kioskUrl  = "http://localhost:$Port/"
$mirrorUrl = "http://localhost:$Port/camera-mirror.html"
# Health check uses 127.0.0.1, not localhost: the server binds IPv4-only, but
# Windows resolves localhost to ::1 first, which hung the readiness wait forever.
# Chrome falls back to IPv4 itself, so browser URLs stay on localhost to keep the
# camera-permission origin consistent.
$healthUrl = "http://127.0.0.1:$Port/"

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }

# --- 1. Locate Chrome -------------------------------------------------------
$chrome = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $chrome) {
  Write-Host "Google Chrome was not found. Install Chrome, then run this again." -ForegroundColor Red
  Read-Host "Press Enter to close"
  exit 1
}

# --- 2. Make sure the server is up -----------------------------------------
function Test-Server {
  try { return (Invoke-WebRequest $healthUrl -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200 }
  catch { return $false }
}

# to check if the booth is running from another folder (for multiple messy copies)
function Test-ServerIsThisProject {
  $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if (-not $conn) { return $false }
  foreach ($procId in ($conn | Select-Object -ExpandProperty OwningProcess -Unique)) {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$procId" -ErrorAction SilentlyContinue
    # Treat an unreadable CommandLine (another user's process) as "not ours".
    if ($proc -and $proc.CommandLine -and $proc.CommandLine -like "*$projectDir*") { return $true }
  }
  return $false
}

# Rebuild if there is no build OR the build is older than the source, so a
# stale build never silently serves old UI after the code changed.
function Test-NeedsBuild {
  $buildId = Join-Path $projectDir ".next\BUILD_ID"
  if (-not (Test-Path $buildId)) { return $true }
  $buildTime = (Get-Item $buildId).LastWriteTime
  $newest    = $null
  foreach ($dir in "src", "public") {
    $full = Join-Path $projectDir $dir
    if (Test-Path $full) {
      $f = Get-ChildItem $full -Recurse -File -ErrorAction SilentlyContinue |
           Sort-Object LastWriteTime -Descending | Select-Object -First 1
      if ($f -and (-not $newest -or $f.LastWriteTime -gt $newest)) { $newest = $f.LastWriteTime }
    }
  }
  foreach ($cfg in "package.json", "next.config.ts", "tsconfig.json", "postcss.config.mjs") {
    $cf = Join-Path $projectDir $cfg
    if (Test-Path $cf) {
      $t = (Get-Item $cf).LastWriteTime
      if (-not $newest -or $t -gt $newest) { $newest = $t }
    }
  }
  return ($newest -and $newest -gt $buildTime)
}

$needsBuild = if ($Dev) { $false } else { Test-NeedsBuild }

if ((Test-Server) -and (Test-ServerIsThisProject) -and -not $needsBuild -and -not $Dev) {
  Write-Step "Booth server already running on port $Port and up to date."
} else {
  if ((Test-Server) -and -not (Test-ServerIsThisProject)) {
    Write-Step "Another app is serving port $Port. Taking the port so this booth is the one you see..."
  }
  # Kill the stale listener so the booth never serves outdated UI.
  $stale = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if ($stale) {
    Write-Step "Stopping the old server on port $Port so the latest build is served..."
    $stale | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {
      try { Stop-Process -Id $_ -Force -ErrorAction Stop } catch {}
    }
    Start-Sleep -Seconds 1
  }

  Push-Location $projectDir
  try {
    if ($Dev) {
      Write-Step "Starting DEV server (npm run dev)..."
      Start-Process "cmd.exe" -ArgumentList "/c npm run dev" -WorkingDirectory $projectDir -WindowStyle Minimized
    } else {
      if ($needsBuild) {
        Write-Step "Building the latest UI (this can take a minute)..."
        npm run build
      }

      Write-Step "Starting production server (npm run start)..."
      Start-Process "cmd.exe" -ArgumentList "/c npm run start -- -H 127.0.0.1 -p $Port" -WorkingDirectory $projectDir -WindowStyle Minimized
    }
  } finally { Pop-Location }

  Write-Step "Waiting for the server to come up..."
  $ready = $false
  for ($i = 0; $i -lt 90; $i++) {
    if (Test-Server) { $ready = $true; break }
    Start-Sleep -Milliseconds 500
  }
  if (-not $ready) {
    Write-Host "Server did not respond on $kioskUrl. Check the minimized server window for errors." -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
  }
  Write-Step "Server is up."
}

# --- 3. Detect displays -----------------------------------------------------
Add-Type -AssemblyName System.Windows.Forms
$screens   = [System.Windows.Forms.Screen]::AllScreens
$primary   = [System.Windows.Forms.Screen]::PrimaryScreen
$secondary = $screens | Where-Object { -not $_.Primary } | Select-Object -First 1

# Decide which display shows which page.
$boothScreen  = $primary
$mirrorScreen = $secondary
if ($SwapMonitors -and $secondary) {
  $boothScreen  = $secondary
  $mirrorScreen = $primary
}

# --- 4. Launch the windows --------------------------------------------------
# Persistent profiles pin each screen to its display and keep the camera permission.
$profileRoot   = Join-Path $env:LocalAppData "ICLBooth"
$boothProfile  = Join-Path $profileRoot "booth-profile"
$mirrorProfile = Join-Path $profileRoot "mirror-profile"

$commonFlags = @(
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-infobars",
  "--disable-translate",
  "--disable-session-crashed-bubble",
  "--disable-pinch",
  "--overscroll-history-navigation=0",
  # One combined --disable-features flag (Chrome only honours the last one, so
  # every feature to disable must live in this single comma-joined list):
  #   TouchpadOverscrollHistoryNavigation - kills the two-finger swipe-back/forward.
  #   OverscrollHistoryNavigation          - kills the touchscreen swipe-back/forward.
  "--disable-features=TouchpadOverscrollHistoryNavigation,OverscrollHistoryNavigation",
  # Don't restore tabs or nag after a crash — the booth should just come back clean.
  "--hide-crash-restore-bubble",
  "--autoplay-policy=no-user-gesture-required"
)

# Pre-grant camera permission so the mirror never shows a prompt or warning strip.
function ConvertTo-HashtableDeep($obj) {
  if ($null -eq $obj) { return $null }
  if ($obj -is [System.Management.Automation.PSCustomObject]) {
    $h = @{}; foreach ($p in $obj.PSObject.Properties) { $h[$p.Name] = ConvertTo-HashtableDeep $p.Value }; return $h
  }
  if ($obj -is [System.Collections.IDictionary]) {
    $h = @{}; foreach ($k in $obj.Keys) { $h[$k] = ConvertTo-HashtableDeep $obj[$k] }; return $h
  }
  if ($obj -is [object[]]) { return @($obj | ForEach-Object { ConvertTo-HashtableDeep $_ }) }
  return $obj
}

function Grant-CameraPermission($profile, $origin) {
  $prefDir  = Join-Path $profile "Default"
  New-Item -ItemType Directory -Force -Path $prefDir | Out-Null
  $prefFile = Join-Path $prefDir "Preferences"

  $prefs = @{}
  if (Test-Path $prefFile) {
    # Read as UTF-8: PS 5.1 Get-Content -Raw defaults to ANSI and would corrupt
    # multi-byte text on the round-trip.
    try { $prefs = ConvertTo-HashtableDeep ([System.IO.File]::ReadAllText($prefFile) | ConvertFrom-Json) } catch { $prefs = @{} }
    if ($null -eq $prefs) { $prefs = @{} }
  }
  if (-not $prefs.ContainsKey('profile')) { $prefs['profile'] = @{} }
  if (-not $prefs['profile'].ContainsKey('content_settings')) { $prefs['profile']['content_settings'] = @{} }
  if (-not $prefs['profile']['content_settings'].ContainsKey('exceptions')) { $prefs['profile']['content_settings']['exceptions'] = @{} }
  $exc = $prefs['profile']['content_settings']['exceptions']
  $key = "$origin,*"
  foreach ($perm in 'media_stream_camera', 'media_stream_mic') {
    if (-not $exc.ContainsKey($perm)) { $exc[$perm] = @{} }
    $exc[$perm][$key] = @{ setting = 1 }   # 1 = Allow
  }
  $json = $prefs | ConvertTo-Json -Depth 100 -Compress
  [System.IO.File]::WriteAllText($prefFile, $json)   # UTF-8, no BOM
}

# $FullscreenMode:
#   "kiosk"      -> --kiosk: locked down, but ignores --window-position (booth touch screen).
#   "fullscreen" -> --start-fullscreen: honors --window-position, lands on a specific monitor (mirror).
function Start-KioskWindow($screen, $profile, $url, $FullscreenMode) {
  $b = $screen.Bounds
  $modeFlag = if ($FullscreenMode -eq "kiosk") { "--kiosk" } else { "--start-fullscreen" }
  $args = @($modeFlag) + $commonFlags + @(
    "--user-data-dir=$profile",
    "--window-position=$($b.X),$($b.Y)",
    "--window-size=$($b.Width),$($b.Height)",
    $url
  )
  Start-Process $chrome -ArgumentList $args
}

# Seed camera/mic permission into both profiles before launching.
$origin = "http://localhost:$Port"
Grant-CameraPermission $boothProfile  $origin
Grant-CameraPermission $mirrorProfile $origin

Write-Step "Opening booth UI on $($boothScreen.DeviceName)..."
Start-KioskWindow $boothScreen $boothProfile $kioskUrl "kiosk"

if ($mirrorScreen) {
  Start-Sleep -Milliseconds 800
  Write-Step "Opening camera mirror on $($mirrorScreen.DeviceName)..."
  # --start-fullscreen so the mirror reliably lands fullscreen on the no-input display.
  Start-KioskWindow $mirrorScreen $mirrorProfile $mirrorUrl "fullscreen"
} else {
  Write-Host "Only one display detected - camera mirror was not opened." -ForegroundColor Yellow
}

Write-Step "ICLBooth is running. To quit a kiosk window press  Alt+F4  (or Ctrl+W)."
