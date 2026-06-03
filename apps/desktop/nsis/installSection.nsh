!include installer.nsh

InitPluginsDir

${IfNot} ${Silent}
  SetDetailsPrint both
  DetailPrint "Starting ${PRODUCT_NAME} installation..."
${endif}

StrCpy $appExe "$INSTDIR\${APP_EXECUTABLE_FILENAME}"

!insertmacro setLinkVars

!ifdef ONE_CLICK
  !ifdef HEADER_ICO
    File /oname=$PLUGINSDIR\installerHeaderico.ico "${HEADER_ICO}"
  !endif
  ${IfNot} ${Silent}
    !ifdef HEADER_ICO
      SpiderBanner::Show /MODERN /ICON "$PLUGINSDIR\installerHeaderico.ico"
    !else
      SpiderBanner::Show /MODERN
    !endif

    FindWindow $0 "#32770" "" $hwndparent
    FindWindow $0 "#32770" "" $hwndparent $0
    GetDlgItem $0 $0 1000
    SendMessage $0 ${WM_SETTEXT} 0 "STR:$(installing)"

    StrCpy $1 $hwndparent
		System::Call 'user32::ShutdownBlockReasonCreate(${SYSTYPE_PTR}r1, w "$(installing)")'
  ${endif}
  !insertmacro CHECK_APP_RUNNING
!else
  ${ifNot} ${UAC_IsInnerInstance}
    !insertmacro CHECK_APP_RUNNING
  ${endif}
!endif

Var /GLOBAL keepShortcuts
StrCpy $keepShortcuts "false"
!insertMacro setIsTryToKeepShortcuts
${if} $isTryToKeepShortcuts == "true"
  ReadRegStr $R1 SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" KeepShortcuts

  ${if} $R1 == "true"
  ${andIf} ${FileExists} "$appExe"
    StrCpy $keepShortcuts "true"
  ${endIf}
${endif}

DetailPrint "Stopping ${PRODUCT_NAME} before removing the previous version..."
!insertmacro KillStudioAppProcessesFull
Sleep 1200
!insertmacro KillStudioAppProcessesFull

!insertmacro uninstallOldVersion SHELL_CONTEXT
!insertmacro handleUninstallResult SHELL_CONTEXT

${if} $installMode == "all"
  !insertmacro uninstallOldVersion HKEY_CURRENT_USER
  !insertmacro handleUninstallResult HKEY_CURRENT_USER
${endIf}

SetOutPath $INSTDIR

!ifdef UNINSTALLER_ICON
  File /oname=uninstallerIcon.ico "${UNINSTALLER_ICON}"
!endif

${IfNot} ${Silent}
  SetDetailsPrint textonly
  DetailPrint "Extracting application package (this step can take a minute)..."
  SetDetailsPrint listonly
  DetailPrint "Decompressing embedded app bundle to $INSTDIR"
${endif}

!insertmacro installApplicationFiles

${IfNot} ${Silent}
  SetDetailsPrint textonly
  DetailPrint "Application files extracted."
  SetDetailsPrint listonly
  DetailPrint "Writing registry entries and shortcuts..."
${endif}

!insertmacro registryAddInstallInfo
!insertmacro addStartMenuLink $keepShortcuts
!insertmacro addDesktopLink $keepShortcuts

${if} ${FileExists} "$newStartMenuLink"
  StrCpy $launchLink "$newStartMenuLink"
${else}
  StrCpy $launchLink "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
${endIf}

!ifmacrodef registerFileAssociations
  !insertmacro registerFileAssociations
!endif

!ifmacrodef customInstall
  !insertmacro customInstall
!endif

${IfNot} ${Silent}
  SetDetailsPrint textonly
  DetailPrint "Installation complete."
  SetDetailsPrint listonly
  DetailPrint "You can close this wizard or launch ${PRODUCT_NAME} from the finish page."
${endif}

!macro doStartApp
  HideWindow
  !insertmacro StartApp
!macroend

!ifdef ONE_CLICK
  !ifdef RUN_AFTER_FINISH
    ${ifNot} ${Silent}
    ${orIf} ${isForceRun}
      !insertmacro doStartApp
    ${endIf}
  !else
    ${if} ${isForceRun}
      !insertmacro doStartApp
    ${endIf}
  !endif
  !insertmacro quitSuccess
!else
  ${if} ${isForceRun}
  ${andIf} ${Silent}
    !insertmacro doStartApp
  ${endIf}
!endif
