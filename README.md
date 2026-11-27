# PC-Temp

Always-on-top Windows 11 hardware monitor widget (Tauri 2 + React + TypeScript + Vite, pnpm).

## Development

- Install [Node.js](https://nodejs.org/) 22+, [pnpm](https://pnpm.io/), and [Rust](https://rustup.rs/) stable.
- `pnpm install`
- Run `powershell -NoProfile -File ./scripts/build-sidecar.ps1` once before `cargo test` or `pnpm tauri dev` (Tauri `externalBin` expects `src-tauri/binaries/lhm-reader-x86_64-pc-windows-msvc.exe`).
- **Elevated terminal required:** run `pnpm tauri dev` from an Administrator terminal; otherwise launching the dev binary fails with `os error 740` (requires elevation). The built `pc-temp.exe` shows a UAC prompt.
- Browser-only mock sensors: `pnpm dev:mock`. Pin a scenario: `pnpm exec cross-env VITE_MOCK_FIXTURE=hot pnpm dev:mock`. Valid `VITE_MOCK_FIXTURE` values: `compact`, `expanded`, `warn`, `hot`, `no-nvml`, `no-pawnio`, `cycle` (default when unset).

### MCP bridge (debug only)

Release / NSIS builds **do not** ship the MCP bridge. For local automation (screenshots, IPC inspection), use the debug overlay config so the optional `mcp-bridge` Cargo feature is enabled and capabilities grant `mcp-bridge:default` only on loopback (`127.0.0.1`):

```powershell
pnpm tauri dev --config src-tauri/tauri.debug.conf.json
# or
pnpm tauri build --debug --config src-tauri/tauri.debug.conf.json
```

In another terminal, connect with the upstream MCP server (install once globally or via `npx`):

```powershell
npx @hypothesi/tauri-mcp-server
```

Confirm the WebSocket listens on `127.0.0.1` (e.g. `netstat -ano | findstr 127.0.0.1`) and not `0.0.0.0`. Plain `pnpm tauri dev` / release `pnpm tauri build` omit the plugin.

## Scripts

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Vite dev server (widget + settings pages) |
| `pnpm dev:mock` | Vite with `VITE_MOCK_SENSORS=1` |
| `pnpm build` | Production frontend build |
| `pnpm test` | Vitest unit tests |
| `pnpm lint` | ESLint (`src/`) |
| `pnpm lint:fix` | ESLint with auto-fix |
| `pnpm format` | Prettier write (`src/`) |
| `pnpm format:check` | Prettier check |
| `pnpm typecheck` | TypeScript |
| `pnpm fmt:rust` | `cargo fmt` for `src-tauri/` |
| `pnpm fmt:rust:check` | `cargo fmt --check` for `src-tauri/` |
| `pnpm lint:rust` | Clippy on `src-tauri/` (`-D warnings`) |
| `pnpm check` | Full local gate: lint, format, typecheck, test, Rust fmt/clippy |
| `pnpm tauri` | Tauri CLI (`pnpm tauri build`, etc.) |

Run `pnpm check` before pushing.

## Repository layout

- `src-tauri/` — Rust core (`pc-temp` / `pc_temp_lib`), manifest, capabilities
- `docs/spec/`, `docs/design/` — build spec and design exports (see READMEs there if assets are still missing)

Integration branch: **`dev`**. Sub-PRs target `dev`, not `main`.

## Designs

- [PC-Temp widget](https://app.paper.design/file/01M7RQV969C1C8VB6JQ71K2MAV) — compact, expanded, mini pill, hot state, settings, and unfocused layouts.
- Static PNG exports for offline review live under [`docs/design/`](docs/design/).
- The Paper file is private; you need access through Nikos's Paper account to open the link.