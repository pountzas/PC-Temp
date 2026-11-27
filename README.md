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

## Verify release provenance

Official Windows installers are built manually via the [**release** workflow](.github/workflows/release.yml) (`workflow_dispatch`). Each run uploads the NSIS `.exe` plus a sidecar `*.exe.sha256` (lowercase hex, no filename line).

1. Download the `pc-temp-windows-installer` artifact from the release workflow run (GitHub sign-in required) and extract the zip; it contains the installer `.exe` and its `.exe.sha256`.
2. **Checksum:** compare the installer hash locally with the `.sha256` file. On Windows PowerShell:

   ```powershell
   $installer = Get-Item .\path\to\PC-Temp_*_x64-setup.exe
   $expected = (Get-Content "$($installer.FullName).sha256" -Raw).Trim().ToLower()
   $actual = (Get-FileHash -Algorithm SHA256 -Path $installer.FullName).Hash.ToLower()
   if ($actual -ne $expected) { throw "SHA-256 mismatch" }
   ```

   On Linux or macOS: `shasum -a 256 path/to/installer.exe` should match the contents of the sidecar file.

3. **Build provenance:** with [GitHub CLI](https://cli.github.com/) authenticated, verify the installer was built by this repository’s release workflow:

   ```bash
   gh attestation verify path/to/PC-Temp_*_x64-setup.exe -R pountzas/PC-Temp
   ```

   Successful verification confirms a Sigstore-backed attestation for that file’s digest tied to the workflow run. Installers are **not** Authenticode-signed yet; see [docs/signing-plan.md](docs/signing-plan.md) for the planned approach.

## Designs

- [PC-Temp widget](https://app.paper.design/file/01M7RQV969C1C8VB6JQ71K2MAV) — compact, expanded, mini pill, hot state, settings, and unfocused layouts.
- Static PNG exports for offline review live under [`docs/design/`](docs/design/).
- The Paper file is private; you need access through Nikos's Paper account to open the link.
