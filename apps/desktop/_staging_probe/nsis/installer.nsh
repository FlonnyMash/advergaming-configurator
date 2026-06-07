; Mashed Games Studio — custom NSIS macros (included by electron-builder).

!pragma warning disable 6012

!include "workspace-defines.nsh"

!macro customHeader
  ShowInstDetails show
  ShowUninstDetails show
!macroend

!macro EnsureMashedGamesWorkspace
  SetShellVarContext current
  ReadRegStr $R2 HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders" "Personal"
  StrCpy $R3 "$R2\${WORKSPACE_DIR}\${WORKSPACE_PROJECTS_DIR}"
  CreateDirectory "$R3"
  DetailPrint "Project workspace ready: $R3"
  DetailPrint "(client.json assets/ paths and ${STUDIO_ASSET_PROTOCOL}:// preview load from here)"
!macroend

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to ${PRODUCT_NAME} Setup"
  !define MUI_WELCOMEPAGE_TEXT "This wizard installs ${PRODUCT_NAME} on your computer.$\r$\n$\r$\nThe install folder you choose is for the application only. Branded game projects and uploaded images are stored separately under Documents\${WORKSPACE_DIR} and are not removed when you change the install location.$\r$\n$\r$\nClick Next to continue, or Cancel to exit Setup."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customInit
  DetailPrint "Preparing ${PRODUCT_NAME} installation..."
  DetailPrint "Embedded dashboard and game-engine preview bundle will be installed to the folder you select."
!macroend

!macro customInstall
  ${if} ${isUpdated}
    DetailPrint "Updating ${PRODUCT_NAME}..."
  ${else}
    DetailPrint "Installing ${PRODUCT_NAME}..."
  ${endif}
  DetailPrint "Application files: $INSTDIR"
  DetailPrint "Bundled /engine preview (template library, not user assets)..."
  !insertmacro EnsureMashedGamesWorkspace
  DetailPrint "Desktop preview will resolve project assets via ${STUDIO_ASSET_PROTOCOL}:// at startup."
  DetailPrint "Creating shortcuts..."
  DetailPrint "Finalizing installation..."
!macroend

!macro customUnInstall
  DetailPrint "Removing application from $INSTDIR..."
  DetailPrint "Keeping Documents\${WORKSPACE_DIR} (projects and assets/)..."
!macroend

!macro KillStudioDashboardChildren
  nsExec::Exec `%SYSTEMROOT%\System32\WindowsPowerShell\v1.0\powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process -Filter \"Name='${APP_EXECUTABLE_FILENAME}'\" | Where-Object { $$_.CommandLine -like '*server.js*' } | ForEach-Object { Stop-Process -Id $$_.ProcessId -Force -ErrorAction SilentlyContinue }"`
!macroend

!macro KillStudioAppProcessesQuick
  !ifdef INSTALL_MODE_PER_ALL_USERS
    nsExec::Exec `taskkill /F /T /IM "${APP_EXECUTABLE_FILENAME}" 2>nul`
  !else
    nsExec::Exec `%SYSTEMROOT%\System32\cmd.exe /c taskkill /F /T /IM "${APP_EXECUTABLE_FILENAME}" /FI "USERNAME eq %USERNAME%" 2>nul`
  !endif
!macroend

!macro KillStudioAppProcessesFull
  !insertmacro KillStudioDashboardChildren
  !insertmacro KillStudioAppProcessesQuick
!macroend

; Cancel = Quit (no partial / broken install).
!macro StudioAbortIfAppStillRunning
  !define StudioAbortUid ${__LINE__}
  studio_abort_check_${StudioAbortUid}:
    !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R8
    ${if} $R8 != 0
      Goto studio_abort_ok_${StudioAbortUid}
    ${endif}
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "${PRODUCT_NAME} is still running.$\r$\n$\r$\nIn Task Manager → Details, end every ${APP_EXECUTABLE_FILENAME} (often two: UI + background server).$\r$\n$\r$\nRetry — try again.$\r$\nCancel — exit Setup without installing (avoids a broken install)." IDRETRY studio_abort_retry_${StudioAbortUid}
    Quit

  studio_abort_retry_${StudioAbortUid}:
    !insertmacro KillStudioAppProcessesFull
    Sleep 1200
    Goto studio_abort_check_${StudioAbortUid}

  studio_abort_ok_${StudioAbortUid}:
  !undef StudioAbortUid
!macroend

!macro customCheckAppRunning
  !ifdef __UNINSTALL__
    DetailPrint `Closing running "${PRODUCT_NAME}" before uninstall...`
    !insertmacro KillStudioAppProcessesQuick
    Sleep 400
    !insertmacro KillStudioAppProcessesQuick
    Goto customCheckAppRunning_done
  !endif

  StrCpy $R1 0

  customCheckAppRunning_loop:
    IntOp $R1 $R1 + 1
    DetailPrint `Closing running "${PRODUCT_NAME}" (attempt $R1)...`
    !insertmacro KillStudioAppProcessesFull
    Sleep 800

    !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
    ${if} $R0 != 0
      Goto customCheckAppRunning_done
    ${endif}

    ${if} $R1 >= 6
      !insertmacro StudioAbortIfAppStillRunning
      Goto customCheckAppRunning_done
    ${endif}

    Sleep 1200
    Goto customCheckAppRunning_loop

  customCheckAppRunning_done:
!macroend
