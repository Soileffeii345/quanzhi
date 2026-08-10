Unregister-ScheduledTask -TaskName '泉知每日数据更新' -Confirm:$false -ErrorAction SilentlyContinue

$Action = New-ScheduledTaskAction -Execute 'node' `
    -Argument '"C:/Users/仙女飞飞/Documents/Codex/2026-08-02/w/collector/daily-lightweight.mjs"' `
    -WorkingDirectory 'C:/Users/仙女飞飞/Documents/Codex/2026-08-02/w'

$Trigger = New-ScheduledTaskTrigger -Daily -At '08:00'

$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 60)

Register-ScheduledTask -TaskName '泉知每日数据更新' `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Description '泉知网站每日数据更新'

Write-Host '--- Task Info ---'
Get-ScheduledTaskInfo -TaskName '泉知每日数据更新'
