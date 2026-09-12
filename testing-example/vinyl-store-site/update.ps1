# ============================================================
# update.ps1 — 把店主导出的库存 CSV 转成网站用的 data.js
# 由「更新网站.bat」调用；也可以在 PowerShell 里手动运行：
#   .\update.ps1 你的表格.csv
# ============================================================
param([string]$CsvPath)

$ErrorActionPreference = "Stop"

function Fail($msg) {
  Write-Host ""
  Write-Host "× $msg" -ForegroundColor Red
  Write-Host "（data.js 保持上一次的内容不变）"
  exit 1
}

if ([string]::IsNullOrWhiteSpace($CsvPath)) {
  Write-Host "用法：把表格软件导出的 CSV 文件拖到「更新网站.bat」图标上松手。"
  exit 1
}
if (-not (Test-Path -LiteralPath $CsvPath)) { Fail "找不到文件：$CsvPath" }

# ── 编码自适应：带 BOM 的 UTF-8 / 无 BOM 的 UTF-8 / GBK（Excel、WPS 在中文系统默认导出 ANSI/GBK）──
$bytes = [System.IO.File]::ReadAllBytes($CsvPath)
if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
  $enc = New-Object System.Text.UTF8Encoding($true)
  $encName = "UTF-8(BOM)"
} else {
  $strict = New-Object System.Text.UTF8Encoding($false, $true)
  try {
    [void]$strict.GetString($bytes)
    $enc = New-Object System.Text.UTF8Encoding($false)
    $encName = "UTF-8"
  } catch {
    $enc = [System.Text.Encoding]::GetEncoding(936)
    $encName = "GBK/ANSI"
  }
}
$text = [System.IO.File]::ReadAllText($CsvPath, $enc)

# ── 解析 CSV（ConvertFrom-Csv 支持带引号的字段，如 "日版, 带侧标"）──
$records = @($text -split "`r?`n" | Where-Object { $_.Trim().Length -gt 0 } | ConvertFrom-Csv)
if ($records.Count -eq 0) { Fail "CSV 里没有数据行（只有表头或空文件）。" }

$headers = @($records[0].PSObject.Properties.Name)
$rows = New-Object System.Collections.Generic.List[object]
foreach ($r in $records) {
  $vals = New-Object System.Collections.Generic.List[string]
  foreach ($h in $headers) { $vals.Add([string]$r.$h) }
  $rows.Add([object[]]$vals.ToArray())
}

$out = @{
  generatedAt = (Get-Item -LiteralPath $CsvPath).LastWriteTime.ToString("yyyy-MM-dd HH:mm")
  sourceFile  = (Split-Path -Leaf $CsvPath)
  headers     = $headers
  rows        = $rows.ToArray()
}
$json = $out | ConvertTo-Json -Depth 6 -Compress

$target = Join-Path $PSScriptRoot "data.js"
$content = "// 由 更新网站.bat 自动生成（源：$($out.sourceFile)）—— 请勿手工编辑`r`nwindow.__INVENTORY__ = $json;`r`n"
[System.IO.File]::WriteAllText($target, $content, (New-Object System.Text.UTF8Encoding($false)))

Write-Host ""
Write-Host "√ 更新完成：共 $($rows.Count) 条库存 → data.js" -ForegroundColor Green
Write-Host "  识别编码：$encName ｜ 时间戳取文件修改时间：$($out.generatedAt)"
Write-Host "下一步：双击 index.html 检查没问题，再把整个文件夹拖到网上（步骤见 更新说明.txt）。"
