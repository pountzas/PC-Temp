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
    ExecWait `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\install-pawnio.ps1" -Quiet $R0` $0
    DetailPrint "PawnIO step finished (exit $0)."
  pawnio_run_done:

  ; Install dir must be under 64-bit Program Files (perMachine) — issue #57
  StrLen $R1 "$PROGRAMFILES64"
  StrCpy $R2 $INSTDIR $R1
  ${If} $R2 != "$PROGRAMFILES64"
    DetailPrint "WARNING: install path is not under Program Files ($INSTDIR); autostart may be refused."
  ${EndIf}
  DetailPrint "Hardening install folder permissions (admin-only write)..."
  ExecWait `"$SYSDIR\icacls.exe" "$INSTDIR" /inheritance:r /T /C` $0
  DetailPrint "icacls inherit exit $0"
  ExecWait `"$SYSDIR\icacls.exe" "$INSTDIR" /grant:r "BUILTIN\Administrators:(OI)(CI)F"` $0
  ExecWait `"$SYSDIR\icacls.exe" "$INSTDIR" /grant:r "NT AUTHORITY\SYSTEM:(OI)(CI)F"` $0
  ExecWait `"$SYSDIR\icacls.exe" "$INSTDIR" /grant:r "NT SERVICE\TrustedInstaller:(OI)(CI)F"` $0
  ExecWait `"$SYSDIR\icacls.exe" "$INSTDIR" /grant:r "BUILTIN\Users:(OI)(CI)RX"` $0
  DetailPrint "Install folder ACL hardened."
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DetailPrint "Removing PC-Temp logon scheduled task..."
  ExecWait `"$SYSDIR\schtasks.exe" /Delete /TN "PC-Temp" /F` $0
  DetailPrint "schtasks delete exit $0 (0 = removed; 1 = task not present or access denied)"
!macroend