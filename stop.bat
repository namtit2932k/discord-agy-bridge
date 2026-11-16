@echo off
cd /d "%~dp0"
schtasks /End /TN "AntigravityDiscordBridge" >nul 2>&1
if exist bot.pid (
  set /p PID=<bot.pid
  taskkill /PID %PID% /F >nul 2>&1
)
powershell -NoProfile -Command "try { Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*discord-agy-bridge*bot.mjs*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; $rem = Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*discord-agy-bridge*bot.mjs*' }; if (-not $rem) { Remove-Item -Force -ErrorAction SilentlyContinue 'bot.pid' } } catch {}" >nul 2>&1
echo Stopped AntigravityDiscordBridge.
