  # Retry counter
  StrCpy $R5 0

  UninstallLoop:
    IntOp $R5 $R5 + 1

    ${if} $R5 > 5
      !insertmacro StudioAbortIfAppStillRunning
      Return
    ${endif}

  OneMoreAttempt:
    DetailPrint "Removing previous version (up to 90 seconds)..."
    !insertmacro KillStudioAppProcessesFull
    Sleep 1000
    !insertmacro KillStudioAppProcessesFull
    ClearErrors
    Exec '"$uninstallerFileNameTemp" /S /KEEP_APP_DATA $0 _?=$installationDir'
    ifErrors TryInPlace

    StrCpy $R6 0
  StudioWaitOldUninstaller:
    IntOp $R6 $R6 + 1
    Sleep 500
    nsExec::Exec `%SYSTEMROOT%\System32\cmd.exe /c tasklist /FI "IMAGENAME eq old-uninstaller.exe" /FO csv 2>nul | %SYSTEMROOT%\System32\find.exe /I "old-uninstaller.exe"`
    Pop $R7
    ${if} $R7 != 0
      Goto StudioWaitOldUninstallerDone
    ${endif}
    ${if} $R6 >= 180
      DetailPrint "Previous uninstaller timed out; terminating..."
      nsExec::Exec `taskkill /F /T /IM old-uninstaller.exe 2>nul`
      !insertmacro KillStudioAppProcessesFull
      Goto StudioWaitOldUninstallerDone
    ${endif}
    Goto StudioWaitOldUninstaller

  StudioWaitOldUninstallerDone:
    !insertmacro StudioAbortIfAppStillRunning
    StrCpy $R0 0
    Goto CheckResult

  TryInPlace:
      DetailPrint "Retrying previous uninstaller from install location..."
      ClearErrors
      Exec '"$uninstallerFileName" /S /KEEP_APP_DATA $0 _?=$installationDir'
      Sleep 8000
      nsExec::Exec `taskkill /F /T /IM old-uninstaller.exe 2>nul`
      !insertmacro KillStudioAppProcessesFull
      !insertmacro StudioAbortIfAppStillRunning
      StrCpy $R0 0
      Goto CheckResult

    CheckResult:
      ${if} $R0 == 0
        Return
      ${endif}

    Sleep 1000
    Goto UninstallLoop

  DoesNotExist:
    SetErrors
