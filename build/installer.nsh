!include "getProcessInfo.nsh"
!include "FileFunc.nsh"
Var pid

!ifndef BUILD_UNINSTALLER
  !include "WordFunc.nsh"

  Var /GLOBAL CodeBudDataBackupDir
!endif

!macro _codebudWriteRestoreNoticeAt targetDir backupPath reason
  DetailPrint "CodeBud data restore failed (${reason}). Backup preserved at: ${backupPath}"
  CreateDirectory "${targetDir}"
  ClearErrors
  FileOpen $R9 "${targetDir}\data-restore-failed.txt" w
  ${IfNot} ${Errors}
    FileWrite $R9 "CodeBud upgrade could not restore your previous data folder (${reason}).$\r$\n"
    FileWrite $R9 "Your original data backup is still preserved at:$\r$\n"
    FileWrite $R9 "${backupPath}$\r$\n"
    FileClose $R9
  ${EndIf}
!macroend

!macro _codebudWriteRestoreNotice reason
  !insertmacro _codebudWriteRestoreNoticeAt "$INSTDIR" "$CodeBudDataBackupDir" "${reason}"
!macroend

!macro _codebudDirHasEntries dirPath outFlag
  Push "${dirPath}"
  Call CodeBudDirHasEntries
  Pop ${outFlag}
!macroend

!ifndef BUILD_UNINSTALLER
  Function CodeBudDirHasEntries
    Exch $R7
    Push $R8
    Push $R9
    FindFirst $R8 $R9 "$R7\*.*"
    StrCpy $R7 "0"
    _codebud_scan_loop:
      StrCmp $R9 "" _codebud_scan_done
      StrCmp $R9 "." _codebud_scan_next
      StrCmp $R9 ".." _codebud_scan_next
      StrCpy $R7 "1"
      Goto _codebud_scan_done
    _codebud_scan_next:
      FindNext $R8 $R9
      Goto _codebud_scan_loop
    _codebud_scan_done:
      FindClose $R8
    Pop $R9
    Pop $R8
    Exch $R7
  FunctionEnd
!endif

!macro _codebudTryBackupFromRoot rootKey
  ${If} $CodeBudDataBackupDir == ""
    StrCpy $R1 ""
    !insertmacro readReg $R1 "${rootKey}" "${UNINSTALL_REGISTRY_KEY}" "DisplayVersion"
    !ifdef UNINSTALL_REGISTRY_KEY_2
      ${If} $R1 == ""
        !insertmacro readReg $R1 "${rootKey}" "${UNINSTALL_REGISTRY_KEY_2}" "DisplayVersion"
      ${EndIf}
    !endif

    StrCpy $R2 ""
    !insertmacro readReg $R2 "${rootKey}" "${INSTALL_REGISTRY_KEY}" "InstallLocation"
    ${If} $R2 == ""
      StrCpy $R3 ""
      !insertmacro readReg $R3 "${rootKey}" "${UNINSTALL_REGISTRY_KEY}" "UninstallString"
      !ifdef UNINSTALL_REGISTRY_KEY_2
        ${If} $R3 == ""
          !insertmacro readReg $R3 "${rootKey}" "${UNINSTALL_REGISTRY_KEY_2}" "UninstallString"
        ${EndIf}
      !endif
      ${If} $R3 != ""
        !insertmacro GetInQuotes $R4 "$R3"
        ${If} $R4 != ""
          ${GetParent} "$R4" $R2
        ${EndIf}
      ${EndIf}
    ${EndIf}

    StrCpy $R3 $R2 1 -1
    ${If} $R3 == "\"
      StrCpy $R2 $R2 -1
    ${EndIf}

    ${If} $R1 != ""
    ${AndIf} $R2 != ""
      ${VersionCompare} "$R1" "0.2.0" $R3
      ${If} $R3 == 2
      ${AndIf} ${FileExists} "$R2\data\*.*"
        ${GetParent} "$R2" $R4
        StrCpy $R5 $R4 1 -1
        ${If} $R5 == "\"
          StrCpy $R4 $R4 -1
        ${EndIf}
        StrCpy $R6 "$R4\CodeBud-data-upgrade-backup"
        ${If} ${FileExists} "$R6\*.*"
          ${GetTime} "" "L" $1 $2 $3 $4 $5 $6 $7
          StrCpy $R6 "$R4\CodeBud-data-upgrade-backup-$3$2$1-$5$6$7"
        ${EndIf}

        DetailPrint "Backing up CodeBud user data ($R1) from $R2\data to $R6..."
        ClearErrors
        CreateDirectory "$R6"
        ${If} ${Errors}
        ${OrIfNot} ${FileExists} "$R6\*.*"
          DetailPrint "Failed to create backup directory: $R6"
          MessageBox MB_OK|MB_ICONSTOP "Cannot back up CodeBud user data before upgrading (failed to create $R6). Upgrade aborted; your data at $R2\data is untouched." /SD IDOK
          SetErrorLevel 2
          Abort "Backup directory creation failed"
        ${EndIf}

        !insertmacro _codebudDirHasEntries "$R2\data" $R7
        ${If} $R7 == "1"
          ClearErrors
          CopyFiles /SILENT "$R2\data\*.*" "$R6"
          ${If} ${Errors}
          ${OrIfNot} ${FileExists} "$R6\*.*"
            DetailPrint "Failed to copy $R2\data to $R6"
            MessageBox MB_OK|MB_ICONSTOP "Cannot back up CodeBud user data before upgrading ($R2\data -> $R6). Upgrade aborted; your original data is untouched." /SD IDOK
            SetErrorLevel 2
            Abort "Backup copy failed"
          ${EndIf}
        ${EndIf}

        StrCpy $CodeBudDataBackupDir "$R6"
        DetailPrint "Backed up CodeBud user data to: $CodeBudDataBackupDir"
      ${EndIf}
    ${EndIf}
  ${EndIf}
!macroend

!macro customCheckAppRunning
  !insertmacro _CHECK_APP_RUNNING
  !ifndef BUILD_UNINSTALLER
    ; Back up <oldInstall>\data before uninstallOldVersion deletes $INSTDIR on upgrades from < 0.2.0.
    StrCpy $CodeBudDataBackupDir ""
    !insertmacro _codebudTryBackupFromRoot "SHELL_CONTEXT"
    !insertmacro _codebudTryBackupFromRoot "HKEY_CURRENT_USER"
  !endif
!macroend

!ifndef BUILD_UNINSTALLER
  !macro _codebudHandleUninstallResult
    IfErrors 0 +3
    DetailPrint `Uninstall was not successful. Not able to launch uninstaller!`
    Return

    ${if} $R0 != 0
      MessageBox MB_OK|MB_ICONEXCLAMATION "$(uninstallFailed): $R0" /SD IDOK
      DetailPrint `Uninstall was not successful. Uninstaller error code: $R0.`
      SetErrorLevel 2
      Quit
    ${endif}
  !macroend

  !macro customUnInstallCheck
    !insertmacro _codebudHandleUninstallResult
  !macroend

  !macro customUnInstallCheckCurrentUser
    !insertmacro _codebudHandleUninstallResult
  !macroend
!endif

!macro customInstall
  !ifndef BUILD_UNINSTALLER
    ${If} $CodeBudDataBackupDir != ""
      ${If} ${FileExists} "$INSTDIR\data"
      ${OrIf} ${FileExists} "$INSTDIR\data\*.*"
        !insertmacro _codebudWriteRestoreNotice "$INSTDIR\data already exists"
      ${Else}
        ClearErrors
        Rename "$CodeBudDataBackupDir" "$INSTDIR\data"
        ${If} ${Errors}
        ${OrIfNot} ${FileExists} "$INSTDIR\data\*.*"
          ClearErrors
          CreateDirectory "$INSTDIR\data"
          ${If} ${Errors}
          ${OrIfNot} ${FileExists} "$INSTDIR\data\*.*"
            !insertmacro _codebudWriteRestoreNotice "failed to create $INSTDIR\data"
          ${Else}
            !insertmacro _codebudDirHasEntries "$CodeBudDataBackupDir" $R7
            ${If} $R7 == "1"
              ClearErrors
              CopyFiles /SILENT "$CodeBudDataBackupDir\*.*" "$INSTDIR\data"
              ${If} ${Errors}
              ${OrIfNot} ${FileExists} "$INSTDIR\data\*.*"
                !insertmacro _codebudWriteRestoreNotice "CopyFiles failed"
              ${Else}
                DetailPrint "Restored CodeBud user data via CopyFiles to $INSTDIR\data"
                RMDir /r "$CodeBudDataBackupDir"
              ${EndIf}
            ${Else}
              DetailPrint "Restored empty CodeBud user data directory to $INSTDIR\data"
              RMDir /r "$CodeBudDataBackupDir"
            ${EndIf}
          ${EndIf}
        ${Else}
          DetailPrint "Restored CodeBud user data to $INSTDIR\data"
        ${EndIf}
      ${EndIf}
    ${Else}
      ${IfNot} ${FileExists} "$INSTDIR\data"
      ${AndIfNot} ${FileExists} "$INSTDIR\data\*.*"
        StrCpy $R4 "$INSTDIR"
        StrCpy $R3 $R4 1 -1
        ${If} $R3 == "\"
          StrCpy $R4 $R4 -1
        ${EndIf}

        ${GetParent} "$R4" $R1
        ${GetFileName} "$R4" $R2
        StrCpy $R3 $R1 1 -1
        ${If} $R3 == "\"
          StrCpy $R1 $R1 -1
        ${EndIf}

        StrCpy $R5 ""
        FindFirst $R8 $R9 "$R1\$R2.data-keep*"
        _codebud_keep_find_loop:
          StrCmp $R9 "" _codebud_keep_find_done
          ${If} ${FileExists} "$R1\$R9\*.*"
            StrCpy $R5 "$R1\$R9"
          ${EndIf}
          FindNext $R8 $R9
          Goto _codebud_keep_find_loop
        _codebud_keep_find_done:
          FindClose $R8

        ${If} $R5 != ""
          ClearErrors
          Rename "$R5" "$R4\data"
          ${If} ${Errors}
          ${OrIfNot} ${FileExists} "$R4\data\*.*"
            !insertmacro _codebudWriteRestoreNoticeAt "$R4" "$R5" "failed to recover .data-keep"
          ${Else}
            DetailPrint "Recovered CodeBud user data from $R5 to $R4\data"
            Delete "$R4\data-restore-failed.txt"
          ${EndIf}
        ${EndIf}
      ${EndIf}
    ${EndIf}
  !endif
!macroend

!macro customRemoveFiles
  ${if} ${isUpdated}
    ; Preserve <installDir>\data across electron-builder's atomicRMDir + restoreFiles rollback flow.
    StrCpy $R4 "$INSTDIR"
    StrCpy $R3 $R4 1 -1
    ${if} $R3 == "\"
      StrCpy $R4 $R4 -1
    ${endif}

    StrCpy $R5 ""
    ${if} ${FileExists} "$R4\data\*.*"
      ${un.GetParent} "$R4" $R1
      ${un.GetFileName} "$R4" $R2
      StrCpy $R3 $R1 1 -1
      ${if} $R3 == "\"
        StrCpy $R1 $R1 -1
      ${endif}
      StrCpy $R5 "$R1\$R2.data-keep"
      ${if} ${FileExists} "$R5"
      ${orIf} ${FileExists} "$R5\*.*"
        ${un.GetTime} "" "L" $1 $2 $3 $4 $5 $6 $7
        StrCpy $R6 "$R5-$3$2$1-$5$6$7"
        StrCpy $R8 0
        _codebud_keep_suffix_loop:
          ${if} ${FileExists} "$R6"
          ${orIf} ${FileExists} "$R6\*.*"
            IntOp $R8 $R8 + 1
            StrCpy $R6 "$R5-$3$2$1-$5$6$7-$R8"
            Goto _codebud_keep_suffix_loop
          ${endif}
        StrCpy $R5 "$R6"
      ${endif}

      ClearErrors
      Rename "$R4\data" "$R5"
      ${if} ${Errors}
      ${orIf} ${FileExists} "$R4\data\*.*"
        DetailPrint "Failed to move $R4\data to $R5 before update; aborting without deleting files."
        Abort `Can't move "$R4\data" to "$R5".`
      ${endif}
    ${endif}

    CreateDirectory "$PLUGINSDIR\old-install"

    Push ""
    Call un.atomicRMDir
    Pop $R0

    ${if} $R0 != 0
      DetailPrint "File is busy, aborting: $R0"

      # Attempt to restore previous directory
      Push ""
      Call un.restoreFiles
      Pop $R0

      ${if} $R5 != ""
        ClearErrors
        Rename "$R5" "$R4\data"
        ${if} ${Errors}
        ${orIfNot} ${FileExists} "$R4\data\*.*"
          !insertmacro _codebudWriteRestoreNoticeAt "$R4" "$R5" "failed to restore .data-keep during rollback"
        ${endif}
      ${endif}

      Abort `Can't rename "$INSTDIR" to "$PLUGINSDIR\old-install".`
    ${endif}

    RMDir /r $INSTDIR

    ${if} $R5 != ""
      CreateDirectory "$R4"
      ClearErrors
      Rename "$R5" "$R4\data"
      ${if} ${Errors}
      ${orIfNot} ${FileExists} "$R4\data\*.*"
        !insertmacro _codebudWriteRestoreNoticeAt "$R4" "$R5" "failed to restore .data-keep after update cleanup"
      ${endif}
    ${endif}
  ${else}
    ; Preserve <installDir>\data where packagedDataDir stores user study data across uninstalls.
    FindFirst $R0 $R1 "$INSTDIR\*.*"
    _codebud_rm_loop:
      StrCmp $R1 "" _codebud_rm_done
      StrCmp $R1 "." _codebud_rm_next
      StrCmp $R1 ".." _codebud_rm_next
      StrCmp $R1 "data" _codebud_rm_next
      IfFileExists "$INSTDIR\$R1\*.*" 0 _codebud_rm_file
        RMDir /r "$INSTDIR\$R1"
        Goto _codebud_rm_next
      _codebud_rm_file:
        Delete "$INSTDIR\$R1"
      _codebud_rm_next:
        FindNext $R0 $R1
        Goto _codebud_rm_loop
    _codebud_rm_done:
      FindClose $R0
      RMDir "$INSTDIR"
  ${endif}
!macroend
