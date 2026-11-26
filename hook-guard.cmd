@echo off
if not defined AGY_DISCORD_GUARD_ACTIVE exit /b 0
if exist "C:\Program Files\nodejs\node.exe" (
  "C:\Program Files\nodejs\node.exe" "%~dp0bot.mjs" --hook-guard
) else (
  node "%~dp0bot.mjs" --hook-guard
)
