# Windows Authenticode signing plan

PC-Temp ships an elevated NSIS installer. Today, release builds are reproducibly tied to GitHub Actions via build provenance and a published SHA-256, but binaries are **unsigned**. Users see SmartScreen warnings until we add Authenticode signing.

This document records two viable paths. **Nikos chooses one** before purchasing or configuring certificates. Implementation (workflow changes, secret storage) is out of scope for issue #59.

## Requirements

- Sign the NSIS installer (and optionally `pc-temp.exe` / `lhm-reader.exe` if we want consistent reputation across extracted binaries).
- Private key must not live on developer laptops; signing runs only in CI or a dedicated HSM-backed service.
- Support timestamping so signatures remain valid after cert expiry.
- Fit a small OSS / personal project budget where possible.

## Option A: Azure Trusted Signing

**What it is:** Microsoft’s cloud code-signing service (formerly Azure Code Signing). Keys stay in Azure; CI requests signatures via API.

**Pros**

- No USB token or physical HSM to manage.
- Integrated with Azure identity and audit logs.
- Straightforward GitHub Actions story via official or community sign actions once the account and certificate profile exist.

**Cons**

- Requires an Azure subscription and Trusted Signing enrollment (pricing and eligibility rules change; confirm before committing).
- Setup is heavier than a one-off EV token for a single maintainer.

**Rough rollout**

1. Create Trusted Signing account + certificate profile (OV/EV per Microsoft’s current offering).
2. Store signing credentials in GitHub Actions secrets (client ID/secret or federated workload identity).
3. Add a post-build step in `release.yml` to sign `*.exe` before attestation and artifact upload (order: build → sign → hash → attest → upload).
4. Document thumbprint and verification with `Get-AuthenticodeSignature` in the README.

## Option B: SignPath OSS (free tier for open source)

**What it is:** [SignPath](https://signpath.io/) provides free code signing for qualifying open-source projects; maintainers submit build artifacts, policy checks run, then SignPath signs with their foundation certificate.

**Pros**

- No certificate purchase for the maintainer.
- Policy-based review can catch unexpected binaries in the installer.
- Good fit for a public GitHub-hosted OSS repo with manual or automated release submissions.

**Cons**

- Extra dependency on SignPath availability and policy turnaround (not fully inline in every CI run unless using their API/integration tier).
- Branding shows SignPath Foundation as signer unless you later add your own cert.

**Rough rollout**

1. Apply for SignPath OSS and define signing policy (which workflows/repos may submit, which files).
2. Integrate submission: either manual upload of release artifacts or SignPath GitHub Action after `pnpm tauri build`.
3. Re-run SHA-256 and provenance attestation on the **signed** installer (digest changes after signing).
4. Publish signed installer + checksum; update README verification steps.

## Decision checklist

| Criterion | Azure Trusted Signing | SignPath OSS |
|-----------|----------------------|--------------|
| Upfront cost | Subscription + cert profile | Free for eligible OSS |
| CI integration | Direct in `release.yml` | Action or submit step |
| Key custody | Azure HSM | SignPath |
| SmartScreen reputation | Builds over time with cert | Foundation cert; may need volume |

**Recommendation:** Prefer **SignPath OSS** if enrollment is accepted quickly and policy latency is acceptable for manual releases. Prefer **Azure Trusted Signing** if we want full control of the publisher name and tight CI-only signing without a third-party submission queue.

## Non-goals (issue #59)

- Purchasing certificates or completing either provider’s enrollment.
- Changing installer logic beyond a future dedicated signing workflow step.