# PC-Temp architecture (wave 0)

## Processes

1. **`pc-temp.exe`** — Tauri 2 host (elevated). Rust owns sensors, settings, window policy; React renders views in `widget` and `settings` webviews.
2. **`lhm-reader.exe`** — future .NET sidecar for CPU via LHM + PawnIO (#5).

## Modules (stubs at final paths)

| Area | Rust | Frontend |
| --- | --- | --- |
| IPC | `src-tauri/src/ipc/*` | `src/ipc/*` |
| Sensors | `src-tauri/src/sensors/*` (mock sources + poller) | mock emitter in `src/ipc/mock` |
| Settings | `src-tauri/src/settings` | `useSettings` |
| Window / tray | `src-tauri/src/window`, `tray` | `src/window/*` stubs |
| Views | — | `src/views/**` stubs wired from `App.tsx` |

`lib.rs` registers all commands, installs store plugin, manages `AppState`, and starts the sensor poller. Later issues fill stub bodies without editing `lib.rs`, `App.tsx`, or `SettingsApp.tsx`.

## Data flow (target)

```
MockCpu/MockGpu or real sources → poller → AppState.last_tick + sensors event → useSensors → views
Settings store → get_settings / settings-changed → useSettings → App view switch
```

## Mock development

`pnpm dev:mock` sets `VITE_MOCK_SENSORS=1`. The UI listens to fixture ticks; Tauri window commands no-op when `!isTauri()`.

See `docs/contracts/ipc.md` for the full contract.