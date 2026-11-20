# LHM reader sidecar protocol (proposed)

The Rust host spawns `lhm-reader.exe` as a long-lived child process. Communication is JSON-lines over stdin/stdout.

## Host → sidecar

| Line | Meaning |
| --- | --- |
| `{"cmd":"read"}` | Request one CPU reading snapshot |
| `{"cmd":"quit"}` | Ask the sidecar to exit |

Each command is a single JSON object followed by `\n`.

## Sidecar → host

Success (one line):

```json
{
  "ok": true,
  "cpu": {
    "name": "Intel Core i7-3770K",
    "packageTempC": 52,
    "packagePowerW": 41,
    "cores": [
      { "index": 0, "tempC": 50, "clockMHz": 3900 }
    ]
  }
}
```

Failure:

```json
{ "ok": false, "error": "PawnIO driver unavailable" }
```

Nullable sensor fields use JSON `null` (never `0`).

Recorded fixture: `src-tauri/src/ipc/fixtures/lhm_read.json`.