// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import expanded from "../../ipc/fixtures/expanded.json";
import noNvml from "../../ipc/fixtures/no-nvml.json";
import noPawnio from "../../ipc/fixtures/no-pawnio.json";
import { defaultSettings } from "../../ipc/settingsDefaults";
import type { IntervalMs, SensorTick, Settings } from "../../ipc/types";
import { CpuSection } from "./CpuSection";
import { ExpandedView } from "./ExpandedView";
import { GpuSection } from "./GpuSection";
import { historyPointCount, sliceHistory } from "./historyWindow";
import { openSettings, updateSettings } from "../../ipc/commands";
import { setView } from "../../window/view";

vi.mock("../../window/view", () => ({ setView: vi.fn() }));
vi.mock("../../ipc/commands", () => ({
  openSettings: vi.fn(),
  updateSettings: vi.fn(),
}));
vi.mock("../../ipc/tauri", () => ({
  isTauri: () => false,
  mockSensorsEnabled: () => true,
}));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ hide: vi.fn() }),
}));

const expandedTick = expanded as SensorTick;
const noNvmlTick = noNvml as SensorTick;
const noPawnioTick = noPawnio as SensorTick;

const baseSettings: Settings = {
  ...defaultSettings(),
  view: "expanded",
  alwaysOnTop: true,
};

function polylinePointCount(html: string): number {
  const re = /<polyline[^>]*points="([^"]+)"/;
  const match = re.exec(html);
  if (!match) {
    return 0;
  }
  return match[1].trim().split(/\s+/).length;
}

function sparklineHtml(tick: SensorTick, section: "cpu" | "gpu"): string {
  const Section = section === "cpu" ? CpuSection : GpuSection;
  return renderToStaticMarkup(<Section tick={tick} units="C" />);
}

function renderExpanded(
  tick: SensorTick | null,
  settings: Settings = baseSettings,
) {
  return render(<ExpandedView tick={tick} settings={settings} />);
}

describe("ExpandedView", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders expanded layout without stub flag", () => {
    const { container } = renderExpanded(expandedTick);
    const root = container.querySelector('[data-view="expanded"]');
    expect(root).not.toBeNull();
    expect(root?.getAttribute("data-stub")).toBeNull();
  });

  it("shows exactly four core cells", () => {
    const { container } = renderExpanded(expandedTick);
    expect(
      container.querySelectorAll("[data-testid^='core-cell-']"),
    ).toHaveLength(4);
  });

  it("does not render GPU POWER stat", () => {
    const gpuHtml = renderToStaticMarkup(
      <GpuSection tick={expandedTick} units="C" />,
    );
    expect(gpuHtml).not.toContain("POWER");
    expect(gpuHtml).toContain("CORE");
    expect(gpuHtml).toContain("FAN");
  });

  it("matches expanded sample strings", () => {
    const { container } = renderExpanded(expandedTick);
    const text = container.textContent;
    expect(text).toContain("Intel Core i7-3770K · 4C/8T");
    expect(text).toContain("3.90 GHz");
    expect(text).toContain("1.15 GHz");
    expect(text).toContain("PACKAGE");
    expect(text).toContain("52");
    expect(text).toContain("41");
    expect(text).toContain("3.5");
    expect(text).toContain("64");
    expect(text).toContain("48");
    expect(text).toContain("3.4 / 6.0 GB");
    expect(text).toContain("LIVE · updates every 1s");
    expect(text).toContain("°C · 60s window");
  });

  it("renders °F footer when settings use Fahrenheit", () => {
    const { container } = renderExpanded(expandedTick, {
      ...baseSettings,
      units: "F",
    });
    expect(container.textContent).toContain("°F · 60s window");
  });

  it("no-nvml: GPU CORE/FAN/VRAM show em dash without units", () => {
    const { container } = renderExpanded(noNvmlTick);
    const gpu = container.querySelector('[data-testid="gpu-section"]');
    expect(gpu?.textContent).toMatch(/CORE[\s\S]*—/);
    expect(gpu?.textContent).toMatch(/FAN[\s\S]*—/);
    const vram = gpu?.querySelector('[data-testid="vram-block"]');
    expect(vram?.textContent).toContain("—");
    expect(vram?.textContent).not.toContain("GB");
    expect(container.querySelector('[data-testid="vram-bar-fill"]')).toBeNull();
  });

  it("no-pawnio: missing pawnio fields dash; core loads still show", () => {
    const { container } = renderExpanded(noPawnioTick);
    const cpu = container.querySelector('[data-testid="cpu-section"]');
    const cpuText = cpu?.textContent ?? "";
    expect(cpuText).toMatch(/PACKAGE[\s\S]*—/);
    expect(cpuText).toMatch(/POWER[\s\S]*—/);
    expect(
      cpu?.querySelector('[data-testid="core-cell-0"]')?.textContent,
    ).toMatch(/—.*35%/);
    expect(cpu?.querySelector('[data-testid="sparkline"]')).not.toBeNull();
  });

  it.each<[IntervalMs, number]>([
    [1000, 60],
    [2000, 30],
    [5000, 12],
  ])("sparkline uses %s points at %sms interval", (intervalMs, expected) => {
    const tick: SensorTick = { ...expandedTick, intervalMs };
    const cpuHtml = sparklineHtml(tick, "cpu");
    const gpuHtml = sparklineHtml(tick, "gpu");
    expect(polylinePointCount(cpuHtml)).toBe(expected);
    expect(polylinePointCount(gpuHtml)).toBe(expected);
    const { container } = renderExpanded(tick);
    const footer = container.querySelector('[data-testid="expanded-footer"]');
    expect(footer?.textContent).toContain(
      `updates every ${intervalMs === 1000 ? "1s" : intervalMs === 2000 ? "2s" : "5s"}`,
    );
  });

  it("padding keeps sparkline window length for sparse pawnio history", () => {
    const windowed = sliceHistory(
      noPawnioTick.history.cpuLoad,
      noPawnioTick.intervalMs,
    );
    expect(windowed).toHaveLength(historyPointCount(1000));
  });

  it("collapse requests compact view", () => {
    const { getByLabelText } = renderExpanded(expandedTick);
    fireEvent.click(getByLabelText("Collapse"));
    expect(setView).toHaveBeenCalledWith("compact");
  });

  it("swallows gear IPC rejection", async () => {
    vi.mocked(openSettings).mockRejectedValueOnce(new Error("ipc"));
    const { getByLabelText } = renderExpanded(expandedTick);
    fireEvent.click(getByLabelText("Settings"));
    await Promise.resolve();
    expect(openSettings).toHaveBeenCalled();
  });

  it("swallows pin IPC rejection", async () => {
    vi.mocked(updateSettings).mockRejectedValueOnce(new Error("ipc"));
    const { getByLabelText } = renderExpanded(expandedTick);
    fireEvent.click(getByLabelText("Always on top"));
    await Promise.resolve();
    expect(updateSettings).toHaveBeenCalled();
  });

  it("swallows collapse IPC rejection", async () => {
    vi.mocked(setView).mockRejectedValueOnce(new Error("ipc"));
    const { getByLabelText } = renderExpanded(expandedTick);
    fireEvent.click(getByLabelText("Collapse"));
    await Promise.resolve();
    expect(setView).toHaveBeenCalledWith("compact");
  });
});
