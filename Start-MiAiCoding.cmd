@echo off
setlocal
cd /d "%~dp0"
set "ELECTRON_RUN_AS_NODE="
set "MIAI_DATA_DIR=%~dp0local-data"
"%~dp0node_modules\electron\dist\electron.exe" "%~dp0start-local.cjs"
if errorlevel 1 (
  echo Application failed to start. Please keep this window for diagnostics.
  pause
)
endlocal
