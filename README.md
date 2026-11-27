# PC-Temp

Always-on-top Windows 11 hardware monitor widget (Tauri 2 + React + TypeScript + Vite, pnpm).

## Development

- Install [Node.js](https://nodejs.org/) 22+, [pnpm](https://pnpm.io/), and [Rust](https://rustup.rs/) stable.
- `pnpm install`
- Run `powershell -NoProfile -File ./scripts/build-sidecar.ps1` once before `cargo test` or `pnpm tauri dev` (Tauri `externalBin` expects `src-tauri/binaries/lhm-reader-x86_64-pc-windows-msvc.exe`).
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

## Verify release provenance

Official Windows installers are built manually via the [**release** workflow](.github/workflows/release.yml) (`workflow_dispatch`). Each run uploads the NSIS `.exe` plus a sidecar `*.exe.sha256` (lowercase hex, no filename line).

1. Download the `pc-temp-windows-installer` artifact from the workflow run (or from a GitHub Release that attaches it).
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