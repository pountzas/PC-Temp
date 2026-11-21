; PC-Temp NSIS installer hooks (#21): optional PawnIO download at install; remove PC-Temp schtask on uninstall.

!define HOOK_FILE_DIR "${__FILEDIR__}"

!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "Checking PawnIO driver (official download if needed)..."
  ExecWait 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\install-pawnio.ps1" -Quiet' $0
  DetailPrint "PawnIO step finished (exit $0)."
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DetailPrint "Removing PC-Temp logon scheduled task..."
  ExecWait 'schtasks.exe /Delete /TN "PC-Temp" /F' $0
!macroend