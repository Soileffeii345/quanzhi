# 泉知 · 每日数据更新 · Windows 定时任务安装脚本
# 用法：右键 → 使用 PowerShell 运行 (管理员权限)

$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$TaskName = "泉知每日数据更新"
$ScriptPath = Join-Path $ProjectDir "collector\daily-lightweight.mjs"
$NodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source
$LogDir = Join-Path $ProjectDir "collector\data"

if (-not $NodeExe) {
    Write-Host "❌ 未找到 Node.js，请先安装 https://nodejs.org" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  泉知 · 每日数据更新 · 定时任务安装" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "项目目录: $ProjectDir" -ForegroundColor Gray
Write-Host "Node.js  : $NodeExe" -ForegroundColor Gray
Write-Host "更新脚本: $ScriptPath" -ForegroundColor Gray
Write-Host ""

# 检查脚本存在
if (-not (Test-Path $ScriptPath)) {
    Write-Host "❌ 找不到更新脚本: $ScriptPath" -ForegroundColor Red
    pause
    exit 1
}

# 删除旧任务（如果有）
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "🗑 删除旧任务..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# 生成日志目录
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

# 创建定时任务
# 每天 08:00 执行
# 注意：SCRIPT 路径中的 daily-lightweight.mjs 使用 concurrency=2 limit=100 快速模式
$Action = New-ScheduledTaskAction -Execute $NodeExe `
    -Argument "`"$ScriptPath`"" `
    -WorkingDirectory $ProjectDir

$Trigger = New-ScheduledTaskTrigger -Daily -At 8:00AM

$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Principal $Principal `
    -Description "泉知网站每日数据更新：发现新商品 → OCR 盒号 → 导出静态数据"

Write-Host ""
Write-Host "✅ 定时任务已安装！" -ForegroundColor Green
Write-Host ""
Write-Host "任务名称: $TaskName" -ForegroundColor White
Write-Host "执行时间: 每天 08:00" -ForegroundColor White
Write-Host "执行命令: node collector/daily-lightweight.mjs" -ForegroundColor Gray
Write-Host ""
Write-Host "──────────────────────────────────────" -ForegroundColor DarkGray
Write-Host " 手动测试: node collector/daily-lightweight.mjs" -ForegroundColor Yellow
Write-Host " 查看任务: taskschd.msc → 搜索 '泉知'" -ForegroundColor Yellow
Write-Host " 删除任务: Unregister-ScheduledTask -TaskName '泉知每日数据更新'" -ForegroundColor Yellow
Write-Host "──────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""
Write-Host "注意: 如果电脑关机了，任务会自动跳过当天，下次开机不会补跑。" -ForegroundColor DarkYellow
Write-Host "如需跳过构建部署，加上 --no-deploy 参数。" -ForegroundColor DarkYellow
Write-Host ""

pause
