; PC-Temp NSIS installer hooks (#21): optional PawnIO download at install; remove PC-Temp schtask on uninstall.

!include LogicLib.nsh

!define HOOK_FILE_DIR "${__FILEDIR__}"

!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "Checking PawnIO driver (official download if needed)..."
  IfFileExists "$INSTDIR\install-pawnio.ps1" pawnio_script_ok pawnio_script_missing
  pawnio_script_missing:
    DetailPrint "WARNING: install-pawnio.ps1 missing from $INSTDIR"
    Goto pawnio_run_done
  pawnio_script_ok:
    StrCpy $R0 ""
    ${If} ${Silent}
      StrCpy $R0 "-NoPrompt"
    ${EndIf}
    ExecWait `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\install-pawnio.ps1" -Quiet $R0` $0
    DetailPrint "PawnIO step finished (exit $0)."
  pawnio_run_done:
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DetailPrint "Removing PC-Temp logon scheduled task..."
  ExecWait 'schtasks.exe /Delete /TN "PC-Temp" /F' $0
  DetailPrint "schtasks delete exit $0 (0 = removed; 1 = task not present or access denied)"
!macroend