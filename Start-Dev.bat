@echo off
cd /d "%~dp0"

REM "start cursor ." is wrong on Windows: "cursor" becomes the window title and "." opens an empty cmd.
where cursor >nul 2>&1
if %ERRORLEVEL%==0 (
  start "" cursor "%~dp0"
) else if exist "%LOCALAPPDATA%\Programs\cursor\Cursor.exe" (
  start "" "%LOCALAPPDATA%\Programs\cursor\Cursor.exe" "%~dp0"
) else (
  echo [Start-Dev] Cursor not found on PATH. Open this folder in your editor: %~dp0
)

REM Open dashboard once Next is likely up (dev servers run in this window).
start "" cmd /c "ping -n 8 127.0.0.1 >nul && start http://localhost:3000"

echo.
echo [Start-Dev] Starting dashboard (http://localhost:3000) and game-engine (http://localhost:5173)...
echo [Start-Dev] Press Ctrl+C to stop both servers.
echo.

pnpm run dev
pause
