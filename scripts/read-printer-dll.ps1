<#
  Checks how many prints are left on the DNP DS-RX1 photo printer and prints the
  answer as one line of JSON, e.g. {"ok":true,"remaining":648,"capacity":700,...}.
    remaining = prints left on the current roll
    capacity  = how many that roll started with

  It reads the numbers through DNP's own cspstat.dll (the same file DNP's
  PrinterInfo app uses). A few things it handles so it behaves on the kiosk:
    - cspstat.dll is 32-bit, so if this runs in 64-bit PowerShell it relaunches
      itself in the 32-bit one.
    - It only reads; it never changes anything on the printer.
    - It won't read mid-print — if a job is running it returns
      {"ok":false,"busy":true} instead, so it doesn't interfere.

  Options:
    -InstallDir   where DNP PrinterInfo is installed (default C:\DNPPIA\PrinterInfo)
    -QueueNames   printer queues to check (default DS-RX1, DS-RX1-Strips)
#>

param(
  [string]$InstallDir  = "C:\DNPPIA\PrinterInfo",
  [string[]]$QueueNames = @("DS-RX1", "DS-RX1-Strips")
)

$ErrorActionPreference = "Stop"
function Emit($o) { $o | ConvertTo-Json -Compress }

# --- Re-launch under 32-bit PowerShell if we are 64-bit --------------------
if ([Environment]::Is64BitProcess) {
  $ps32 = Join-Path $env:WINDIR "SysWOW64\WindowsPowerShell\v1.0\powershell.exe"
  if (-not (Test-Path $ps32)) { Emit @{ ok = $false; error = "32-bit PowerShell not found at $ps32" }; exit 1 }
  & $ps32 -NoProfile -ExecutionPolicy Bypass -File $PSCommandPath @PSBoundParameters
  exit $LASTEXITCODE
}

# --- Never query while printing --------------------------------------------
foreach ($q in $QueueNames) {
  try {
    $jobs = @(Get-PrintJob -PrinterName $q -ErrorAction SilentlyContinue)
    if ($jobs.Count -gt 0) { Emit @{ ok = $false; busy = $true; reason = "print job active on $q" }; exit 0 }
  } catch { }
}

$dll = Join-Path $InstallDir "cspstat.dll"
if (-not (Test-Path $dll)) { Emit @{ ok = $false; error = "cspstat.dll not found in $InstallDir (install DNP PrinterInfo)" }; exit 1 }

# cspstat.dll and its dependencies must resolve from the install dir.
[Environment]::CurrentDirectory = $InstallDir
$env:PATH = "$InstallDir;$env:PATH"

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class CspStat {
  [DllImport("cspstat.dll", CallingConvention=CallingConvention.StdCall)] public static extern int GetPrinterPortNum(byte[] pArray, int arraysize);
  [DllImport("cspstat.dll", CallingConvention=CallingConvention.StdCall)] public static extern int GetMediaCounter(int portno);
  [DllImport("cspstat.dll", CallingConvention=CallingConvention.StdCall)] public static extern int GetMediaCountOffset(int portno);
  [DllImport("cspstat.dll", CallingConvention=CallingConvention.StdCall)] public static extern int GetInitialMediaCount(int portno);
  [DllImport("cspstat.dll", EntryPoint="GetStatus", CallingConvention=CallingConvention.StdCall)] public static extern uint GetStatus(int portno);
}
"@

try {
  # Init / enumerate. This call opens the port; the Get* reads return -1 without it.
  $buf = New-Object byte[] 128
  $printers = [CspStat]::GetPrinterPortNum($buf, 128)
  if ($printers -lt 1) { Emit @{ ok = $false; error = "No DNP printer detected by cspstat.dll" }; exit 1 }

  $port      = 0   # single printer -> port index 0
  $rawCounter = [CspStat]::GetMediaCounter($port)
  $offset     = [CspStat]::GetMediaCountOffset($port)
  $rawInitial = [CspStat]::GetInitialMediaCount($port)
  $status     = [CspStat]::GetStatus($port)

  if ($rawCounter -lt 0 -or $offset -lt 0) {
    Emit @{ ok = $false; error = "cspstat read failed (counter=$rawCounter offset=$offset)"; statusRaw = ("0x{0:X8}" -f $status) }; exit 1
  }

  $remaining = $rawCounter - $offset
  $capacity  = if ($rawInitial -ge 0) { $rawInitial - $offset } else { $null }

  Emit @{
    ok         = $true
    remaining  = $remaining
    capacity   = $capacity
    rawCounter = $rawCounter
    offset     = $offset
    statusRaw  = ("0x{0:X8}" -f $status)
    printers   = $printers
  }
}
catch {
  Emit @{ ok = $false; error = $_.Exception.Message }
  exit 1
}
