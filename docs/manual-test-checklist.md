# Manual test checklist (HW-21 / issue #22)

Run elevated on the target machine (Intel Core i7-3770K + NVIDIA GeForce GTX 980 Ti). Attach screenshots as you complete each item. This document copies the acceptance checklist from [issue #22](https://github.com/pountzas/PC-Temp/issues/22); manual sign-off stays with Nikos.

## Launch and shell

- [ ] UAC prompt on manual launch; none at sign-in via the `PC-Temp` task (highest privileges).
- [ ] Mica on focus; solid `#1D1F25` + inactive border when unfocused, data colours unchanged (compare 06).

## Views and scaling

- [ ] Compact / Expanded / Pill / Settings / Hot match 01–05 at 100 % and 150 % scaling.

## CPU sensors

- [ ] CPU: 4 core temps + package temp + package power + clocks with PawnIO; all "—" without PawnIO; CPU load always present. Values sane vs. LibreHardwareMonitor GUI.

## GPU sensors

- [ ] GPU: temp, load, clock, fan, VRAM 6144 MiB total; no GPU power shown anywhere.

## Poll interval

- [ ] Interval 1 s / 2 s / 5 s live; sparkline 60 / 30 / 12 points.

## Window behaviour

- [ ] Always on top over a focused full-window app; click-through on/off from tray; Settings from tray while click-through is on.
- [ ] Drag via grip; dock to right edge → pill; drag out → previous view; position remembered after restart.

## Load and hot state

- [ ] GPU load test (e.g. a game/benchmark) and record the max GPU temp (the 980 Ti usually holds ~83–84 °C, below the 85 °C amber line); check the hot look with `hot.json`.

## Lifecycle and installer

- [ ] Quit leaves no `lhm-reader.exe`; CPU/RAM use of the widget at 1 s recorded.
- [ ] Installer + uninstaller (task removed).

## MCP bridge smoke (issue #76, manual — Nikos)

- [ ] With `pnpm tauri dev --config src-tauri/tauri.debug.conf.json`, `netstat` shows the bridge on `127.0.0.1` only (not `0.0.0.0`); `npx @hypothesi/tauri-mcp-server` can attach and capture a screenshot.
- [ ] Release `pnpm tauri build` (no debug config): no MCP bridge port; `cargo tree -p pc-temp --release` omits `tauri-plugin-mcp-bridge`.

## Follow-up

Record max temps under load and OQ-22 (Mica + shadow) in epic #1. File failures as follow-up issues; do not block this checklist on automated integration tests.