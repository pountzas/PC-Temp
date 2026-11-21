# Hardware Monitor Widget — build spec

**Date:** 2026-11-19 · **Updated:** 2026-11-20 · **Design:** Paper file "Hardware Monitor Widget" — https://app.paper.design/file/01M7RQV969C1C8VB6JQ71K2MAV
**Source of truth for values:** `/workspace/hw_widget/gen.py` → `html/0*.html` (the exact HTML written to Paper). PNGs at 2x: `/workspace/hw_widget/0*-*.png`.
**Product name:** PC-Temp (wordmark **PC-TEMP**).
**Target:** Tauri 2 · Windows 11 · runs as admin (approved by Nikos) · Intel Core i7-3770K (4C/8T, Ivy Bridge) · NVIDIA GeForce GTX 980 Ti (Maxwell, 6 GB).

**Decisions (Nikos, 2026-11-19):**
- **Mica only.** The widget is a real Windows 11 Mica window. The CSS-glass option and the Acrylic choice are dropped.
- **Corners and borders.** 8px window corners. No outer glow, no glowing edge.
- **Hot warning.** Moves inside the panel.
- **Compact gets an expand button.**
- **Pill samples** now match Compact.
- **Start with Windows** uses a Task Scheduler logon task with highest privileges, not the autostart plugin.
- **Elevation.** The whole app runs elevated.

**Decisions (Nikos, 2026-11-20):**
- **Unfocused / inactive Mica look is designed.** Do not ship an undesigned solid fallback. Artboard **06 Unfocused** shows the Compact widget in the inactive state. See §2.6.
- **Product name is PC-Temp.** The wordmark is **PC-TEMP** on every artboard that showed "SYS/MON".
- **GPU power is hidden completely.** No GPU POWER stat in Expanded, and no wattage in the Hot footer. CPU package power stays.
- **Thresholds:** warn (amber) at **85 °C**, hot (red) at **90 °C**, the same for CPU and GPU. The 04 Hot GPU sample is **92 °C** (98% load), so it sits in the red range. See §7.
- **Opacity** changes only the **panel background**, default **72%**. The Settings label stays "Opacity" (it did not imply whole-window opacity).
- **Sensor sidecar:** a LibreHardwareMonitor **.NET 4.8.1** sidecar. The **installer downloads PawnIO**.
- **Pin** toggles **always on top** (drawn on).
- **Close** hides the widget **to the tray**; it does not quit. Quit lives in the tray menu.
- **Start with Windows** defaults **on**.

Labels used below:
- **[sample]**: a mock number in the design, not a spec.
- **[guess]**: my suggestion, not drawn.
- **[HC → token]**: the HTML hard-codes this raw value. Use the named token instead. Every colour in the HTML was written raw; the tokens exist in the Paper file but were not referenced.
- **[no token]**: no token exists yet. A proposed one is in §3.

---

## 1. Overview

| # | View | Paper artboard | Panel size (px) | Mock backdrop |
|---|---|---|---|---|
| 1 | Compact | 01 Compact widget | 320 × 200 | 640 × 400 |
| 2 | Expanded | 02 Expanded widget | 420 × 540 | 720 × 640 |
| 3 | Mini pill (docked) | 03 Mini pill — docked | 220 × 44 | 640 × 240 |
| 4 | Hot state | 04 Hot state | 320 × 200 (the Compact panel) | 640 × 400 |
| 5 | Settings popover | 05 Settings popover | 320 × 358 | 720 × 520 |
| 6 | Unfocused / inactive | 06 Unfocused (`1C2-2`) | 320 × 200 (the Compact panel, same position 160, 82) | 640 × 400 |

The backdrop (blurred wallpaper, taskbar strip, top-left note) is mock context only. Do not build it.

How the views connect:
- **Compact ↔ Expanded.**
  - Compact header buttons: gear · **expand** · pin · close.
  - Expanded header buttons: gear · **collapse** · pin · close.
  - The expand and collapse icons are 14px and swap places between the two views. *(Resolved 2026-11-19.)*
  - **Pin** toggles always on top (same setting as the Settings toggle). Drawn on.
  - **Close** hides the widget to the tray. It does not quit.
- **Dock to pill.** Dragging the widget to a screen edge docks it as the pill. The canvas note says: "Docked to the right edge. Drag out to undock." Only right-edge docking is drawn.
- **Settings.**
  - Opened from the **gear**, and from the **tray** (required, because the gear can't be clicked while click-through is on; §5).
  - Drawn as a separate 8px panel beside the Compact widget, with a 12 px gap. The widget behind it is dimmed to opacity 0.55.
- **Hot state.** The Compact view switches to it automatically when the GPU passes the red threshold. It is drawn for the GPU only.
- **Unfocused / inactive.** Every view uses this look whenever the window is not the foreground window, which is the usual state for an always-on-top widget. Drawn on Compact in 06. The same solid fill and inactive border apply to Expanded, Pill, Hot and Settings (those variants are not redrawn). See §2.6.

---

## 2. Views

### 2.0 Shared parts

**Mica window panel**, used by Compact, Expanded, Hot, Settings, the Pill, and Unfocused:

| Property | Value |
|---|---|
| Real-app material | **Mica** via `setEffects` / `windowEffects` (§5). The page background stays transparent so Mica shows through. Mica is opaque and tints from the wallpaper and theme (Microsoft Learn: https://learn.microsoft.com/en-us/windows/apps/design/style/mica). |
| Mock fill (focused) | Stands in for Mica in Paper only. Do **not** ship it. `background-color #1D1F25` + `linear-gradient(135deg, rgba(38,92,140,0.24) 0%, rgba(29,31,37,0) 55%, rgba(92,40,130,0.22) 100%)`, which tints blue top-left and purple bottom-right like the mock wallpaper. **[mock-only]** |
| Fill (unfocused) | Solid `--color-mica-inactive` `#1D1F25`. Same base as the focused mock fill, with the wallpaper-tint gradient removed. See §2.6. |
| Corner radius | **8px**, the Windows 11 radius for top-level windows, flyouts and dialogs (Microsoft Learn, *Geometry in Windows 11*: https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/geometry). In the app the OS draws it (§5), not CSS. |
| Border (focused) | 1px rgba(255,255,255,0.10) **[no token → `--color-window-border`]**. Stands in for the 1px border Windows draws on an undecorated window with `shadow: true` (§5). |
| Border (unfocused) | 1px `--color-window-border-inactive` rgba(255,255,255,0.16). Slightly stronger so the solid panel reads against any wallpaper. The 16% alpha is the same value as the mock taskbar active-icon fill already in Compact. |
| Shadow | `0 8px 24px rgba(0,0,0,0.45)` **[mock-only; stands in for the OS window shadow]**. No outer glow. |
| Scanlines | Content-layer overlay `repeating-linear-gradient(0deg, rgba(255,255,255,0.02) 0 1px, transparent 1px 3px)` **[no token]** |
| Edge highlight | **Removed.** The glowing top line is gone. A red line returns in the Hot state (§2.4). |
| Overflow | hidden |

**Header**, 24px tall, `row`, `space-between`, `align-items:center`:

| Element | Spec |
|---|---|
| Left group | row, gap 8 |
| Drag grip | SVG 10×14, 6 dots r=1.2 at x∈{2,8}, y∈{2,7,12}, fill #56637A **[HC → `--color-faint`]**. This is the drag region. |
| Wordmark "PC-TEMP" | Rajdhani 700 · 12px / 14px · 0.22em · #EAF2F8 **[HC → `--color-text`]**. Product name: PC-Temp. |
| Right group | row, gap 2 |
| Icon button | 24×24, radius **4** (the Windows 11 in-page control radius; `--radius-sm`), bg transparent |
| Icon button, active (pin on) | bg rgba(34,229,255,0.12) **[no token]** |
| Icons | gear 14px, expand 14px, pin 14px (always on top), collapse 14px (stroke 2, #93A3B5 **[HC → `--color-muted`]**; the active pin uses #22E5FF), close 12px (stroke 2.2; hides to tray) |

**Arc gauge** (load %):
- **Geometry:** size S, stroke `sw`, radius `r = S/2 − sw/2 − 3`. The arc sweeps 270°, from 135° to 405° (clockwise, opening at the bottom). The value sweep is 270° × load/100.
- **Layers:**
  - Track: stroke rgba(255,255,255,0.08) **[no token]**, round caps.
  - Value glow: stroke `sw+5`, accent at stroke-opacity 0.25.
  - Value: stroke `sw`, accent, round caps.
  - Ticks at 0/50/100%: 1px #56637A, from `r+sw/2+1` to `r+sw/2+3.5`.
- **Centre, column:**
  - Value: JetBrains Mono 700 · B / B+2 · −0.02em · `--color-text`. The "%" suffix is `int(B×0.55)`px in `--color-muted`.
  - Label "LOAD": Rajdhani 600 · 10 / 12 · 0.16em · `--color-muted`.
- **Sizes:** Compact S=62, sw=5, B=18 (% = 9px). Expanded S=84, sw=6, B=22 (% = 12px).

**Temperature bar:**
- **Shape:** 4px tall, radius 999. Track rgba(255,255,255,0.08). Scale 0–100 °C. Fill width = w × t/100.
- **Fill colour:** accent if t < 85, `--color-warm` #FFB020 if 85 ≤ t < 90, `--color-hot` #FF3B4E if t ≥ 90. Glow `0 0 8px <fill colour>`.
- **Threshold ticks:** 1×10px at 85 (amber) and 90 (red), top −3px. *(Decided 2026-11-20, §7.)*

**Sparkline (60 s):**
- **Size:** w × 30 SVG, plus a 14px label row. y scale is 0–100% load.
- **Layers:**
  - Dashed midline: 1px rgba(255,255,255,0.07), dash 2 3.
  - Area fill: accent at fill-opacity 0.12.
  - Line: 1.5px, round join.
  - End dot: r 2.5, accent.
- **Labels:** "-60s" / "LOAD %" / "now", JetBrains Mono 9 / 11, `--color-faint`, space-between, top = h+2.

### 2.1 Compact (320 × 200)

Panel: padding 14, radius 8 (Mica window, §2.0), `column`.

| Element | Layout | Type / fill |
|---|---|---|
| Header | §2.0. Buttons: gear, **expand**, pin (active), close | — |
| Body row | margin-top 14, row, space-between | — |
| CPU column / GPU column | each 140 wide, column, gap 12 | — |
| ↳ top row | row, align center, gap 10: gauge (S62) + text column (gap 2) | — |
| ↳ label "CPU" / "GPU" | — | Rajdhani 700 · 13 / 14 · 0.18em · `--color-cpu` #22E5FF / `--color-gpu` #B65CFF |
| ↳ temperature "52" + "°C" | — | JetBrains Mono 700 · 28 / 30 · −0.03em. Colour: `--color-text` below 85, `--color-warm` 85–89, `--color-hot` 90 and up. "°C" is 14px `--color-muted`. |
| ↳ model "i7-3770K" / "GTX 980 Ti" | — | Inter 400 · 10 / 12 · `--color-faint` |
| ↳ temperature bar | width 140 | §2.0 |
| Footer | margin-top auto, row, space-between, align center | JetBrains Mono 9 / 11 · `--color-faint`. Left: "UPDATE 1s · 3.90 / 1.15 GHz" (interval · CPU clock / GPU clock). Right: "14:32:07". |

Sample values **[sample]**: CPU load 34%, 52 °C. GPU load 58%, 64 °C. Clocks 3.90 / 1.15 GHz.

### 2.2 Expanded (420 × 540)

Panel: padding 18, radius 8 (Mica window), `column`. Inner content width 384.

| Element | Layout | Type / fill |
|---|---|---|
| Header | §2.0. Buttons: gear, collapse, pin (active), close | — |
| Content | margin-top 14, column, gap 16: CPU section · divider · GPU section | Divider: 1px rgba(255,255,255,0.09) **[HC → `--color-line`]** |
| Section | column, gap 12 | — |
| Section title | row, baseline, space-between. Left: name + model, gap 10 | Name: Rajdhani 700 · 15 / 16 · 0.2em · accent. Model: Inter 400 · 11 / 14 · `--color-muted`. Right: clock, JetBrains Mono 400 · 11 / 14 · `--color-text` |
| Gauge row | row, align center, gap 16: gauge S84 + column (flex 1 = 284 wide, gap 10) | — |
| Stats | column, gap 2, width 80. The row of stats has gap 12. CPU has three (PACKAGE, POWER, BASE). GPU has two (CORE, FAN); GPU power is not shown. | Label: Rajdhani 600 · 10 / 12 · 0.16em · `--color-muted`. Value: JetBrains Mono 700 · 20 / 22 · −0.02em · `--color-text`, unit 11px `--color-muted` |
| CPU temperature bar | width 284 | §2.0 |
| CPU core cells (×4) | row, space-between. Cell: 84 wide, column, gap 5 | Top row (baseline, space-between): "CORE n" in Rajdhani 600 · 10 / 12 · 0.16em · `--color-muted`, and the temperature "52°" in JetBrains Mono 700 · 13 / 14 · `--color-text`. Bottom row (gap 6): bar 56×3 with track rgba(255,255,255,0.08), fill `--color-cpu` and glow 0 0 6px, then "31%" in JetBrains Mono 9 / 10 · `--color-muted` |
| VRAM block (GPU) | column, gap 5, width 284 | Label row (space-between): "VRAM" in Rajdhani 600 · 10 / 12 · 0.16em · `--color-muted`, and "3.4 / 6.0 GB" in JetBrains Mono, letter-spacing 0, `--color-text`. Bar: 284×4, fill `--color-gpu`, glow 8px |
| Sparkline | 384 × 30 | §2.0, accent per section |
| Footer | margin-top auto, padding-top 10, border-top 1px rgba(255,255,255,0.06) **[no token]**, row, space-between | Left (gap 6): live dot 6×6, radius 999, **#3DFFA8 [no token → propose `--color-live`]**, glow 0 0 6px #3DFFA8, then "LIVE · updates every 1s" in JetBrains Mono 10 / 12 · `--color-muted`. Right: "°C · 60s window" in JetBrains Mono 10 / 12 · `--color-faint` |

Sample values **[sample]**:
- **CPU, titled "Intel Core i7-3770K · 4C/8T":** 3.90 GHz, load 34%, PACKAGE 52 °C, POWER 41 W, BASE 3.5 GHz.
- **Cores 0–3:** 52°/31%, 55°/42%, 50°/28%, 54°/36%.
- **GPU, titled "NVIDIA GeForce GTX 980 Ti":** 1.15 GHz, load 58%, CORE 64 °C, FAN 48%, VRAM 3.4 / 6.0 GB. GPU power is not shown.
- **No GPU hotspot:** Maxwell does not expose one.
- **Core cells vs threads:** I chose **4 physical-core cells** (temperature + load) over 8 thread bars, because the CPU reports temperature per core.

### 2.3 Mini pill (220 × 44), docked to the right edge

| Property | Value |
|---|---|
| Container | Mica window panel (§2.0): radius **8px on all corners** (Windows rounds a window that isn't snapped or maximized), 1px window border, OS shadow. Layout: row, align center, gap 12, padding 0 14 0 12. Docked flush against the work area's right edge. |
| Children | grip · CPU part · divider (1×20, rgba(255,255,255,0.12)) · GPU part |
| Part | row, gap 7. Label in Rajdhani 700 · 11 / 12 · 0.16em · accent. Then a column (gap 3): temperature in JetBrains Mono 700 · 15 / 16 · `--color-text`, and a bar 30×3 with track rgba(255,255,255,0.10), fill accent, glow 0 0 6px |
| Screen-edge glow strip | **Removed** (it sat outside the window). |

Sample values **[sample]**: CPU 52° (load 34%), GPU 64° (load 58%). These now match Compact. *(Resolved 2026-11-19.)*

### 2.4 Hot state (the Compact view, GPU at or above red)

The same layout as §2.1. With no outer glow, the warning lives **inside** the panel:

| Element | Hot value |
|---|---|
| Inner red edge | `box-shadow: inset 0 0 0 1px rgba(255,59,78,0.55)` (inside the window, so it isn't clipped) **[no token]**, plus a 2px top bar #FF3B4E (`--color-hot`) across the full width, clipped by the 8px corners |
| Outer glow / red blob | **Removed** |
| "GPU HOT" chip (header, after the wordmark) | Height 18, padding 0 8, radius 999, gap 6. Fill rgba(255,59,78,0.16), border 1px rgba(255,59,78,0.5). Text: Rajdhani 700 · 10 / 12 · 0.14em · **#FF6B7A [no token → `--color-hot-text`]**. Dot 6×6 `--color-hot`, glow 0 0 6px (inside the panel). |
| GPU gauge arc | `--color-hot`, whatever the load |
| GPU temperature text and bar | `--color-hot` (rule: 90 and up) |
| Footer left | "TEMP LIMIT · 1.02 GHz · FAN 78%" (no wattage; GPU power is hidden) |

Sample values **[sample]**: CPU 61% / 68 °C (below amber, so it stays white). GPU 98% / 92 °C, clock 1.02 GHz, fan 78%.

### 2.5 Settings popover (320 × 358)

Panel: padding 16, radius 8 (Mica flyout), `column`. It is a separate Mica window.

| Element | Spec |
|---|---|
| Header | 24px, space-between. "SETTINGS" in Rajdhani 700 · 13 / 14 · 0.22em · `--color-text`, plus a close button. |
| List | margin-top 8, column |
| Row | min-height 40, row, space-between, align center, border-bottom 1px rgba(255,255,255,0.06). Label column (gap 2): label in Inter 500 · 13 / 16 · `--color-text`, optional sub-label in Inter 400 · 11 / 14 · `--color-faint` |
| Last row (Theme accent) | min-height 44, no border |
| Slider | row, gap 10. Track 110×4, radius 999, rgba(255,255,255,0.10). Fill `--color-cpu`, glow 8px. Thumb 14×14, radius 999, `--color-text`, ring `0 0 0 3px rgba(34,229,255,0.3)`, top −5. Value in JetBrains Mono 11 / 14, width 30, right-aligned. |
| Toggle | 34×18, radius 999, knob 14×14 at top 2. **On:** bg rgba(34,229,255,0.9), glow 0 0 10px rgba(34,229,255,0.45), knob at left 18, #05070C (`--color-bg`). **Off:** bg rgba(255,255,255,0.12), knob at left 2, `--color-muted`. |
| Segmented control | Container: padding 2, radius 4 (`--radius-sm`), bg rgba(255,255,255,0.06). Item: padding 3 9, radius 3 **[no token; nested inside 4]**, JetBrains Mono 11 / 14. **Selected:** bg rgba(34,229,255,0.16), text `--color-cpu`. **Unselected:** `--color-muted`. |
| Accent swatch | 18×18, radius 999, gap 10. Selected ring `0 0 0 2px #05070C, 0 0 0 3.5px <c>, 0 0 10px <c>`. Colours: #22E5FF, #B65CFF, **#3DFFA8 [no token]**, #FFB020. |

Rows as drawn **[sample state]**. The Backdrop row was **removed**, because Mica is fixed:

| Row | Control | Drawn value | Sub-label |
|---|---|---|---|
| Opacity | slider | 72% | Changes only the panel background, not the whole window. The drawn label is "Opacity" (no sub-label). |
| Click-through | toggle | off | "Clicks pass through · turn off from tray" |
| Always on top | toggle | on | — |
| Units | segmented: °C \| °F | °C | — |
| Update interval | segmented: 1s \| 2s \| 5s | 1s | — |
| Start with Windows | toggle | on | "Runs at sign-in via Task Scheduler (admin)" |
| Theme accent | 4 swatches | cyan | — |

---

## 2.6 Unfocused / inactive state

Drawn on artboard **06 Unfocused** (`1C2-2`). The artboard is the same 640 × 400 mock backdrop as 01 Compact, and the panel is the Compact widget at the same size and position: **320 × 200** at **(160, 82)**. Samples match Compact: CPU 34% / 52 °C, GPU 58% / 64 °C **[sample]**.

This is the look Windows will show most of the time. An always-on-top widget is usually not the foreground window, and Mica then falls back to a solid colour (Microsoft Learn, Mica: it uses `SolidBackgroundFillColorBase` when the window is inactive, when transparency is off, in Battery Saver, or on low-end hardware). Tauri's `EffectState` (Active/Inactive) is **macOS only**, so it cannot force the tinted look on Windows (§5).

**What changes versus the focused Compact panel (01):**

| Property | Focused (01) | Unfocused (06) |
|---|---|---|
| Panel fill | Mock Mica: `#1D1F25` + the blue/purple 135° wallpaper-tint gradient **[mock-only]** | Solid `--color-mica-inactive` `#1D1F25`. No gradient. This is the same base as the focused mock fill, close to `--color-bg` `#05070C` lifted to the existing panel base. |
| Border | 1px rgba(255,255,255,0.10) (`--color-window-border`) | 1px `--color-window-border-inactive` rgba(255,255,255,0.16) |
| Wallpaper tint | Visible in the mock fill | None — the panel is opaque and does not pick up the wallpaper |

**What does not change:** 8px corners (`--radius-md` / `--radius-window`), the OS-shadow stand-in `0 8px 24px rgba(0,0,0,0.45)` **[mock-only]**, the scanline overlay, padding 14, header, gauges, temperature bars, typography, and all data colours at full strength: CPU `#22E5FF`, GPU `#B65CFF`, amber `#FFB020`, red `#FF3B4E`. Readings stay fully legible. Do not dim or desaturate them.

**Hot state, unfocused:** not redrawn as its own artboard. Apply the same solid `--color-mica-inactive` fill and the 1px inactive border on top of the existing Hot treatments in 04 (red inner edge `inset 0 0 0 1px rgba(255,59,78,0.55)`, 2px `#FF3B4E` top bar, "GPU HOT" chip, red arc). Those warning marks stay at full strength.

**Detecting focus in Tauri 2** (Window JS API: https://v2.tauri.app/reference/javascript/api/namespacewindow/):

- Preferred: `getCurrentWindow().onFocusChanged(({ payload: focused }) => { … })`. The payload is a boolean.
- Equivalent window events: `tauri://focus` and `tauri://blur`.

Toggle a class on the document root, for example `is-unfocused`, when the payload is `false` or on `tauri://blur`, and remove it on focus.

**What the app has to paint:**

Mica itself handles the tint. While the window is focused, keep the page background **transparent** so Mica shows through (already required in §5). The designed solid fill is only needed as a CSS class swap for the fallback background if the webview is transparent-rendering — i.e. when Mica is not compositing the OS solid behind the page, or to lock the fallback to `--color-mica-inactive` `#1D1F25` rather than whatever `SolidBackgroundFillColorBase` the theme uses (dark theme is typically `#202020`, 3 RGB values off our token).

```css
html { background: transparent; }
html.is-unfocused { background: var(--color-mica-inactive); } /* #1D1F25 */
```

Do not change data-colour rules, layout, or corner radius in that class. The 1px inactive border can be applied on the same class if the OS border is not visible (`border: 1px solid var(--color-window-border-inactive)`), but on an undecorated window with `shadow: true` Windows already draws a 1px border — treat the CSS border as a fallback, the same way the focused border is mock-only in §2.0 / §5.


---

## 3. Tokens

These are the tokens in the Paper file, exactly as created. The proposed additions cover the hard-coded values.

```css
:root {
  /* colour, from the Paper file */
  --color-bg: #05070C;
  --color-glass: rgba(12,17,26,0.64);   /* Paper token; unused under Mica (the panel background is transparent) */
  --color-glass-raised: rgba(255,255,255,0.05);
  --color-line: rgba(255,255,255,0.09);
  --color-edge: rgba(120,225,255,0.35);
  --color-text: #EAF2F8;
  --color-muted: #93A3B5;
  --color-faint: #56637A;
  --color-cpu: #22E5FF;
  --color-gpu: #B65CFF;
  --color-warm: #FFB020;
  --color-hot: #FF3B4E;
  --color-mica-inactive: #1D1F25;       /* added 2026-11-20; solid Mica fallback when unfocused */
  --color-window-border-inactive: rgba(255,255,255,0.16); /* added 2026-11-20; unfocused 1px border */
  /* type */
  --font-mono: "JetBrains Mono";
  --font-display: "Rajdhani";
  --font-sans: "Inter";
  --text-xs: 10px;
  --text-sm: 12px;
  --text-md: 14px;
  --text-lg: 20px;
  --text-xl: 30px;
  --font-weight-regular: 400;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  --tracking-tight: -0.02em;
  --tracking-caps: 0.14em;
  --opacity-muted: 40%;
  /* radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 14px;
  --radius-pill: 999px;
  /* spacing */
  --spacing-1: 4px;
  --spacing-2: 8px;
  --spacing-3: 12px;
  --spacing-4: 16px;
  --spacing-5: 20px;
  --spacing-6: 24px;
  /* containers */
  --container-pill: 220px;
  --container-compact: 320px;
  --container-expanded: 420px;
  --breakpoint-desktop: 1280px;

  /* PROPOSED: not in Paper, they cover hard-coded values [guess names] */
  --color-live: #3DFFA8;                 /* live dot, green accent swatch */
  --color-hot-text: #FF6B7A;             /* "GPU HOT" chip text */
  --color-track: rgba(255,255,255,0.08); /* gauge and bar tracks */
  --color-divider: rgba(255,255,255,0.06); /* settings rows, Expanded footer rule */
  --color-accent-bg: rgba(34,229,255,0.12); /* active icon button (segmented uses 0.16) */
  --color-window-border: rgba(255,255,255,0.10); /* mock of the Windows 1px border */
  --radius-window: 8px;                  /* Win11 top-level windows and flyouts (OS-drawn) */
  --radius-control: 4px;                 /* Win11 in-page controls (= --radius-sm) */
  /* mock-only Mica stand-in, NOT for the app: #1D1F25 + blue/purple 135deg tint */
}
```

**Values off the token scales** (snap them or add tokens; Q8):
- **Font sizes used:** 9, 10, 11, 12, 13, 14, 15, 18, 20, 22, 28. The scale is 10/12/14/20/30.
- **Letter-spacing used:** −0.03, −0.02, 0, 0.04, 0.14, 0.16, 0.18, 0.2, 0.22em.
- **Radii used:** 3, 4, 8, 999. The old 5/6/7/14/16 are gone. `--radius-lg` (14px) is now unused.
- **Gaps and paddings used:** 2, 3, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18.

---

## 4. States

**Drawn:**

| State | Where |
|---|---|
| Default | Compact, Expanded, Pill |
| Active / selected | Pin button (active bg), toggles on/off, segmented selected, swatch selected |
| Dimmed (0.55 opacity) | Compact behind the open Settings popover |
| Hot / warning (red) | GPU in 04 Hot state, shown inside the panel (inner red edge, top bar, chip, red arc) |
| Amber (85–89 °C) | **Colour rule only.** No sample value falls in this range, so amber appears only as the threshold ticks. |
| Unfocused / inactive | Compact in 06: solid `--color-mica-inactive` fill, 1px `--color-window-border-inactive` border, data colours unchanged. |

**Not drawn** (open questions; do not invent):
- Hover, pressed and keyboard focus for the icon buttons, toggles, segmented control, slider and swatches (Q4).
- Disabled controls, e.g. Mica if the OS doesn't support it (Q4).
- Sensor unavailable: a single reading returns nothing, e.g. a CPU temperature without the PawnIO driver (Q5). GPU power is never shown, so it is not an unavailable-state case.
- Loading / first sample before the 60 s buffer fills (Q5).
- CPU hot, Pill hot, amber example, and both CPU and GPU hot (Q6).
- A visible indicator while click-through is on (Q7).
- The undock drag (Q2).

---

## 5. Tauri 2 window and system integration

All APIs below are checked against the Tauri 2 docs:
- Window JS API: https://v2.tauri.app/reference/javascript/api/namespacewindow/
- Config reference: https://v2.tauri.app/reference/config/
- System tray: https://v2.tauri.app/learn/system-tray/
- Autostart plugin (checked, **not used**): https://v2.tauri.app/plugin/autostart/
- Build manifest: https://docs.rs/tauri-build/latest/tauri_build/struct.WindowsAttributes.html
- Rust `WebviewWindow` methods (`set_effects`, `set_ignore_cursor_events`, `set_always_on_top`, `set_position`, `set_size`, `current_monitor`, `start_dragging`) were checked on https://docs.rs/tauri/latest/tauri/webview/struct.WebviewWindow.html

**`tauri.conf.json` window** (config keys checked: `transparent`, `decorations`, `alwaysOnTop`, `skipTaskbar`, `resizable`, `shadow`, `windowEffects`):

```json
{
  "app": {
    "windows": [{
      "label": "widget",
      "width": 320, "height": 200,
      "transparent": true,
      "decorations": false,
      "alwaysOnTop": true,
      "skipTaskbar": true,
      "resizable": false,
      "shadow": true,
      "windowEffects": { "effects": ["mica"] }
    }]
  }
}
```

- **`windowEffects` / `setEffects`:** Mica only *(decided 2026-11-19)*.
  - The window must be `transparent`, and the page background must be transparent so Mica shows through.
  - `mica` is Windows 11 only. No Acrylic, no in-app backdrop switch.
  - Permission `core:window:allow-set-effects` is needed only if the frontend calls `setEffects`; configuring it in `tauri.conf.json` is enough.
- **Mica behaviour to expect** (Microsoft Learn, Mica page):
  - It is opaque and samples the wallpaper once.
  - It falls back to a **solid colour** (`SolidBackgroundFillColorBase`) when the window is **inactive**, when transparency is off, in Battery Saver, or on low-end hardware.
  - An always-on-top widget is usually *inactive* (focus is in another app), so expect the solid fallback most of the time. The designed look is in §2.6 (artboard 06).
  - Tauri's `EffectState` (Active/Inactive) is documented as **macOS only**, so it can't force the active look on Windows. Detect focus with `onFocusChanged` or the `tauri://focus` / `tauri://blur` events, and swap the CSS fallback background as described in §2.6.
- **Corners and border:** `shadow: true` on an undecorated window gives Windows 11 rounded corners and a 1px border (Tauri config docs). This matches the 8px design. Don't add CSS border-radius or a border on the root; those are mock-only.
- **Always on top:** `setAlwaysOnTop(bool)`, permission `core:window:allow-set-always-on-top`. The **pin** button and the Settings "Always on top" toggle are the same setting. Default **on**, as drawn.
- **Close hides to tray** *(decided 2026-11-20)*: the header close button calls `hide()` (`core:window:allow-hide`). It does not quit and does not destroy the window. Quit is a tray-menu item that calls `exit` / `close` on the app.
- **Click-through:**
  - `setIgnoreCursorEvents(true)`, or Rust `set_ignore_cursor_events`. Permission: `core:window:allow-set-ignore-cursor-events`.
  - While it is on, the widget can't receive clicks, so the **tray menu must hold a "Click-through" check item** that calls `set_ignore_cursor_events(false)` in Rust. Do it in Rust so it never depends on the webview.
- **Tray icon:**
  - Cargo feature `tray-icon`, then `TrayIconBuilder::new().menu(&menu).on_menu_event(...)`.
  - Menu **[guess items; close-to-tray is decided]**: Show/Hide widget · Click-through ✓ · Settings… · Quit.
  - Left click: `show_menu_on_left_click(false)`, and handle `TrayIconEvent::Click` to show and focus the widget.
  - Closing the widget with the header close button is equivalent to Hide.
- **Drag:** `startDragging()` on mousedown in the grip/header. Permission: `core:window:allow-start-dragging`.
- **Resizing between views:**
  - Uses `setSize`/`setPosition` with permissions `core:window:allow-set-size` and `core:window:allow-set-position`.
  - Sizes: Compact 320×200, Expanded 420×540, Pill 220×44.
- **Start with Windows: Task Scheduler logon task** *(decided 2026-11-19; default **on**, 2026-11-20)*.
  - Windows blocks apps that require elevation from launching via the user's Run key or Startup folder. They fail silently. Sources:
    - https://stackoverflow.com/questions/2293609
    - https://stackoverflow.com/questions/16185165
  - Toggle **on**: create the task, e.g. `schtasks /Create /SC ONLOGON /TN "PC-Temp" /TR "\"<exe>\"" /RL HIGHEST /F`, set to run only when the user is logged on, so the UI is visible.
  - Toggle **off**: `schtasks /Delete /TN "PC-Temp" /F`.
  - Read the current state with `schtasks /Query /TN "PC-Temp"`.
  - Run these from Rust (`std::process::Command`). The app is already elevated, so no prompt appears.
  - **Do not use** `tauri-plugin-autostart`.
  - The Settings toggle is drawn **on** (the default).
- **Admin manifest:** in `src-tauri/build.rs`, call `tauri_build::WindowsAttributes::new().app_manifest(include_str!("manifest.xml"))`, passed through `Attributes::new().windows_attributes(...)`.
  - `manifest.xml` must keep the default **Common-Controls v6** dependency and add `<requestedExecutionLevel level="requireAdministrator" uiAccess="false"/>`, per the docs.rs example.
  - This causes a UAC prompt on every manual launch.
- **Edge docking (pill)** **[guess logic; APIs checked]:**
  1. Listen with `onMoved` (debounce about 150 ms **[guess]**).
  2. Read `currentMonitor()` → `monitor.workArea` (physical position and size, excluding the taskbar). Convert with `scaleFactor`.
  3. If the window's right edge is within 16px **[guess]** of the work area's right edge, `setSize(220,44)` and `setPosition(workArea.right − 220, clampedY)`.
  4. Undock when the user drags it more than 40px **[guess]** away, restoring the last view (Compact or Expanded).
- **Capability file** `src-tauri/capabilities/default.json`, permissions:
  - `core:default`
  - `core:window:allow-start-dragging`
  - `core:window:allow-set-size`
  - `core:window:allow-set-position`
  - `core:window:allow-set-always-on-top`
  - `core:window:allow-set-ignore-cursor-events`
  - `core:window:allow-set-effects` (only if the frontend calls `setEffects`)
  - `core:window:allow-hide`
  - `core:window:allow-close`
  - No `autostart:*` (plugin not used).
  - `core:window:default` covers getters only, which includes `currentMonitor`/`cursorPosition`.

---

## 6. Data

**Sources:**

| Reading | Source | Notes |
|---|---|---|
| CPU per-core temperature (Core 0–3), package temperature | LibreHardwareMonitor (`LibreHardwareMonitorLib`) via a **.NET 4.8.1 sidecar** exe *(decided 2026-11-20)* | Needs a kernel driver. LHM swapped the Defender-flagged **WinRing0** for **PawnIO** (merged 2025-09-16). The **installer downloads PawnIO**. Microsoft flags WinRing0 as `VulnerableDriver:WinNT/Winring0` (CVE-2020-14979). Do not ship WinRing0. |
| CPU package power | LHM (RAPL energy counter, available on Ivy Bridge) | Same driver |
| CPU load: total, per thread (8), per core (4) | Windows performance counters or the `sysinfo` crate. No admin needed. | Per-core load = mean of each core's 2 SMT threads **[guess mapping; confirm thread↔core pairing]** |
| CPU clock (effective, per core) | LHM | `sysinfo` may report the nominal frequency only **[unverified]** |
| GPU core temperature | NVML: `nvml-wrapper` `Device::temperature(TemperatureSensor::Gpu)` | — |
| GPU load | `Device::utilization_rates()` → `.gpu` | — |
| GPU core clock | `Device::clock_info(Clock::Graphics)` (MHz) | — |
| GPU fan | `Device::fan_speed(0)` (%) | Percent only, not RPM |
| GPU power | — | **Hidden completely** *(decided 2026-11-20)*. Do not poll it, do not put it in the payload, and do not draw a POWER stat on the GPU. CPU package power is unaffected. |
| VRAM used/total | `Device::memory_info()` | Total 6.0 GB (6144 MiB) |
| GPU hotspot | — | Not available on Maxwell. Not shown. |

`nvml-wrapper` method names were checked on https://docs.rs/nvml-wrapper/latest/nvml_wrapper/device/struct.Device.html

**Polling:** 1 s / 2 s / 5 s from Settings (default 1 s, as drawn). Use one Rust timer, emit one event per tick, and change the interval live.

**Sparkline buffer:** a 60 s ring buffer per series (CPU load, GPU load), holding `60 / interval` samples (60 / 30 / 12). Keep it in Rust so it survives webview reloads **[guess]**. The x axis is always "-60s → now".

**Fallback for missing readings:**
- A reading that errors or returns `NotSupported` is sent as `null`. Never send `0`.
- The UI shows "—" in `--color-faint` and hides that stat's bar or arc fill. The visual is not designed yet (Q5).
- After 3 consecutive failures **[guess]**, stop polling that reading until the app restarts.
- With no PawnIO driver, the CPU temperature, power and clock are all `null`. CPU load still works.

**Event payload** (Rust `emit("sensors", …)` → frontend):

```ts
type Celsius = number;
type Pct = number;     // 0–100
type MHz = number;
type Watts = number;

interface SensorTick {
  ts: number;                     // unix ms
  intervalMs: 1000 | 2000 | 5000;
  cpu: {
    name: string;                 // "Intel Core i7-3770K"
    loadPct: Pct | null;          // total
    packageTempC: Celsius | null;
    packagePowerW: Watts | null;
    clockMHz: MHz | null;         // max effective core clock
    baseClockMHz: 3500;
    cores: Array<{ index: 0|1|2|3; tempC: Celsius | null; loadPct: Pct | null; clockMHz: MHz | null }>;
    threads?: Array<{ index: number; loadPct: Pct | null }>; // 8, optional
  };
  gpu: {
    name: string;                 // "NVIDIA GeForce GTX 980 Ti"
    loadPct: Pct | null;
    coreTempC: Celsius | null;
    coreClockMHz: MHz | null;
    fanPct: Pct | null;
    // no powerW — GPU power is hidden completely
    vramUsedMiB: number | null;
    vramTotalMiB: number | null;  // 6144
  };
  history: { cpuLoad: Array<Pct | null>; gpuLoad: Array<Pct | null> }; // last 60 s, oldest first
  alerts: Array<{ component: "cpu" | "gpu"; level: "warm" | "hot"; tempC: Celsius }>;
}
```

---

## 7. Thresholds

- **Decided 2026-11-20:** amber (warn) at **85 °C**, red (hot) at **90 °C**, the same for CPU and GPU. They drive the bar ticks, bar fill, temperature text colour and the Hot state.
- **GTX 980 Ti:** NVIDIA lists a maximum GPU temperature of **92 °C**. GPU Boost's default temperature target is about **83 °C** (TechSpot's review notes it "runs into the 84 °C temperature limit quickly"). Under the decided thresholds, a stock boost at ~83–84 °C stays below amber. The Hot-state sample is **92 °C** at 1.02 GHz (the listed maximum), which is in the red range.
- **i7-3770K:** Intel lists T_case 67.4 °C. Tj max is not on that page **[commonly 105 °C; unverified here]**. The sample temps (52 / 68 °C) stay below amber.
- Whether the user can change the thresholds in Settings is still open (Q11 remainder).

---

## 8. Assets

All icons are inline SVG, from `gen.py` `ICON`:

| Icon | Size | Spec |
|---|---|---|
| grip | 10×14 | 6 circles r=1.2, fill `--color-faint` |
| gear | 14 (24 viewBox) | stroke 2, `--color-muted` |
| pin | 14 (24 viewBox) | stroke 2, `--color-cpu` when active. Toggles always on top. The inactive colour is not drawn. |
| close | 12 (24 viewBox) | stroke 2.2, `--color-muted`. Hides the widget to the tray. |
| collapse | 14 (24 viewBox) | stroke 2, `--color-muted` |
| expand | 14 (24 viewBox) | stroke 2, `--color-muted`. Used in the Compact header. |

**Gauge, bars and sparklines:** generated SVG/CSS at runtime. No image assets.

**Still needed:**
- Tray icon: `.ico` with 16/20/24/32px, plus a monochrome variant for light and dark taskbars **[not designed]**.
- App icon set: `tauri icon` from a 1024px PNG **[not designed]**.

**Fonts:** bundle as woff2 rather than relying on system installs:
- JetBrains Mono 400/700
- Rajdhani 600/700
- Inter 400/500

---

## 9. Open questions

**Resolved 2026-11-19 (Nikos):**
- ~~Q1 Compact → Expanded control~~ → an expand button in the Compact header; collapse in Expanded.
- ~~Q3 Glass rendering~~ → **Mica only**, OS 8px corners, no outer glow; CSS glass dropped.
- ~~Q9 Elevation model~~ → the whole app runs elevated (`requireAdministrator`); Start with Windows via a Task Scheduler logon task with highest privileges.
- ~~Q13 Pill vs Compact samples~~ → Pill now shows 52° / 64°.

**Resolved 2026-11-20 (Nikos):**
- ~~Q14 Mica inactive fallback~~ → design the unfocused look. Artboard 06 Unfocused; solid `--color-mica-inactive` `#1D1F25`, 1px `--color-window-border-inactive` rgba(255,255,255,0.16), data colours unchanged. See §2.6.
- ~~Q12 Product name~~ → **PC-Temp**, wordmark **PC-TEMP**.
- ~~Q11 Threshold values~~ → amber 85 °C, red 90 °C, same for CPU and GPU. Whether the user can edit them is still open.
- ~~Q10 Sensor sidecar / PawnIO~~ → LHM **.NET 4.8.1 sidecar**; the **installer downloads PawnIO**. Whether LHM or NVML supplies the GPU readings is still open.

**Still open:**
2. Pill: dock to any edge or only the right? Should undock be animated?
4. Hover, pressed, focus and disabled styles are not drawn for any control.
5. How should a sensor-unavailable reading and the loading / first-sample state look? Especially CPU readings without PawnIO. (GPU power is hidden completely, so it is no longer part of this question.)
6. Should CPU-hot, amber, Pill-hot and dual-hot states be designed? Should hot also send a Windows notification?
7. Should the widget show an indicator while click-through is on?
8. Should the type and spacing values be snapped to the token scale, or should the scale grow (§3)?
10. Remainder: should LHM supply the GPU readings too, or NVML?
11. Remainder: should the user be able to change the 85 / 90 °C thresholds?
