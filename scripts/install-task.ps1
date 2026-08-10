$TaskName = "QuanzhiDailyUpdate"
$ProjectDir = "C:\Users\仙女飞飞\Documents\Codex\2026-08-02\w"
$ScriptPath = "$ProjectDir\collector\daily-lightweight.mjs"
$NodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source

if (-not $NodeExe) {
    Write-Host "ERROR: Node.js not found"
    exit 1
}

Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue | Unregister-ScheduledTask -Confirm:$false

$Action = New-ScheduledTaskAction -Execute $NodeExe -Argument "`"$ScriptPath`" --no-push" -WorkingDirectory $ProjectDir
$Trigger = New-ScheduledTaskTrigger -Daily -At 8:00AM
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Description "Quanzhi daily data update"

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) {
    Write-Host "OK: Task installed. Next trigger: $($task.Triggers[0].StartBoundary)"
    Write-Host "Check: taskschd.msc -> QuanzhiDailyUpdate"
} else {
    Write-Host "FAILED to install task"
    exit 1
}
