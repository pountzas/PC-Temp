# PC-Temp

Always-on-top Windows 11 hardware monitor widget (Tauri 2 + React + TypeScript + Vite, pnpm).

## Development

- Install [Node.js](https://nodejs.org/) 22+, [pnpm](https://pnpm.io/), and [Rust](https://rustup.rs/) stable.
- `pnpm install`
- **Elevated terminal required:** run `pnpm tauri dev` from an Administrator terminal; otherwise launching the dev binary fails with `os error 740` (requires elevation). The built `pc-temp.exe` shows a UAC prompt.
- Browser-only mock sensors: `pnpm dev:mock`. Pin a scenario: `pnpm exec cross-env VITE_MOCK_FIXTURE=hot pnpm dev:mock`. Valid `VITE_MOCK_FIXTURE` values: `compact`, `expanded`, `warn`, `hot`, `no-nvml`, `no-pawnio`, `cycle` (default when unset).

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