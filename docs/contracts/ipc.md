# IPC contract (HW-02)

Single source for Tauri commands, events, and payloads shared with the React UI.

## Events

| Name | Payload |
| --- | --- |
| `sensors` | `SensorTick` (spec §6, no GPU power field) |
| `settings-changed` | `Settings` |
| `view-changed` | `{ "view": "compact" \| "expanded" \| "pill" }` |
| `settings-window` | `{ "open": boolean }` |

## Commands

| Command | Args | Returns |
| --- | --- | --- |
| `get_snapshot` | — | `SensorTick \| null` |
| `get_settings` | — | `Settings` |
| `update_settings` | `patch: Partial<Settings>` | `Settings` |
| `set_view` | `view` | — |
| `open_settings` | — | — |
| `close_settings` | — | — |
| `set_click_through` | `enabled: boolean` | — |
| `get_autostart` | — | `boolean` |
| `quit_app` | — | — |

TypeScript wrappers live in `src/ipc/commands.ts`; Rust handlers in `src-tauri/src/ipc/commands.rs`.

## SensorTick

Field-for-field match with spec §6 except **no GPU power field anywhere**. Nullable readings stay `null` in JSON on both sides. Types: `src/ipc/types.ts`, `src-tauri/src/ipc/types.rs`.

Fixtures for mocks and tests: `src/ipc/fixtures/*.json`.

## Settings

Shape defined in issue #3 (defaults owned by #9). Version field is always `1`.

## Thresholds

Shared constants: warn `85 °C`, hot `90 °C`, hysteresis `3 °C` — `src/lib/thresholds.ts` and `src-tauri/src/config/thresholds.rs`.

## Sidecar

See [lhm-reader-protocol.md](./lhm-reader-protocol.md).