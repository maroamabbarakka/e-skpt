param(
  [Parameter(Mandatory = $true)][string]$PortraitSheet,
  [Parameter(Mandatory = $true)][string]$KtpSheet,
  [string]$OutputDirectory = "assets/uat/generated-20260928"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$resolvedOutput = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $OutputDirectory))
$workspace = [System.IO.Path]::GetFullPath((Get-Location).Path)
if (-not $resolvedOutput.StartsWith($workspace, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "OutputDirectory wajib berada di dalam workspace."
}
[System.IO.Directory]::CreateDirectory($resolvedOutput) | Out-Null

function Export-GridCells {
  param([string]$Source, [string]$Prefix, [int]$Columns = 4, [int]$Rows = 3)
  $image = [System.Drawing.Bitmap]::FromFile($Source)
  try {
    $cellWidth = [math]::Floor($image.Width / $Columns)
    $cellHeight = [math]::Floor($image.Height / $Rows)
    for ($index = 0; $index -lt ($Columns * $Rows); $index++) {
      $column = $index % $Columns
      $row = [math]::Floor($index / $Columns)
      $width = if ($column -eq ($Columns - 1)) { $image.Width - ($column * $cellWidth) } else { $cellWidth }
      $height = if ($row -eq ($Rows - 1)) { $image.Height - ($row * $cellHeight) } else { $cellHeight }
      $rect = New-Object System.Drawing.Rectangle ($column * $cellWidth), ($row * $cellHeight), $width, $height
      $cell = $image.Clone($rect, $image.PixelFormat)
      try {
        $number = ($index + 1).ToString("00")
        $target = Join-Path $resolvedOutput "$Prefix-$number.jpg"
        $cell.Save($target, [System.Drawing.Imaging.ImageFormat]::Jpeg)
      } finally {
        $cell.Dispose()
      }
    }
  } finally {
    $image.Dispose()
  }
}

Copy-Item -LiteralPath $PortraitSheet -Destination (Join-Path $resolvedOutput "portrait-contact-sheet.png")
Copy-Item -LiteralPath $KtpSheet -Destination (Join-Path $resolvedOutput "ktp-dummy-contact-sheet.png")
Export-GridCells -Source $PortraitSheet -Prefix "profil-ujicoba"
Export-GridCells -Source $KtpSheet -Prefix "ktp-dummy-ujicoba"

Get-ChildItem -LiteralPath $resolvedOutput | Select-Object Name, Length
