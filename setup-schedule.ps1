# Papfast Daily Task Setup Script
# Run as Administrator

$TaskName = "Papfast-Daily"
$TaskPath = "D:\2026_project\Papfast"
$NodePath = (Get-Command node).Source
$ScriptPath = "$TaskPath\src\index.js"

# Check if task exists
$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

if ($existingTask) {
    Write-Host "Task exists, updating..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Create trigger: Daily at 7:00 AM
$Trigger = New-ScheduledTaskTrigger -Daily -At 7:00AM

# Create action
$Action = New-ScheduledTaskAction -Execute $NodePath -Argument $ScriptPath -WorkingDirectory $TaskPath

# Create settings
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd -AllowStartIfOnBatteries

# Register task
Register-ScheduledTask -TaskName $TaskName -Trigger $Trigger -Action $Action -Settings $Settings -Description "Papfast Daily Paper Subscription"

Write-Host "Task created successfully!" -ForegroundColor Green
Write-Host "Task Name: $TaskName"
Write-Host "Run Time: Daily at 7:00 AM"
Write-Host "Command: node $ScriptPath"
Write-Host ""
Write-Host "Management Commands:" -ForegroundColor Cyan
Write-Host "  View: Get-ScheduledTask -TaskName '$TaskName'"
Write-Host "  Run:  Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "  Stop: Disable-ScheduledTask -TaskName '$TaskName'"
Write-Host "  Delete: Unregister-ScheduledTask -TaskName '$TaskName'"
