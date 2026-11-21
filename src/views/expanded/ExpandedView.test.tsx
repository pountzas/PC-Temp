// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import expanded from "../../ipc/fixtures/expanded.json";
import noNvml from "../../ipc/fixtures/no-nvml.json";
import noPawnio from "../../ipc/fixtures/no-pawnio.json";
import type { IntervalMs, SensorTick } from "../../ipc/types";
import { CpuSection } from "./CpuSection";
import { ExpandedView } from "./ExpandedView";
import { GpuSection } from "./GpuSection";
import { sliceHistory } from "./historyWindow";
import { setView } from "../../window/view";

vi.mock("../../ipc/useSettings", () => ({
  useSettings: () => ({
    version: 1 as const,
    opacityPct: 72,
    clickThrough: false,
    alwaysOnTop: true,
    units: "C" as const,
    intervalMs: 1000 as const,
    startWithWindows: true,
    accent: "#22E5FF" as const,
    view: "expanded" as const,
    lastUndockedView: "compact" as const,
    position: null,
  }),
}));

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

describe("ExpandedView", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });
  it("renders expanded layout without stub flag", () => {
    const { container } = render(<ExpandedView tick={expandedTick} />);
    const root = container.querySelector('[data-view="expanded"]');
    expect(root).not.toBeNull();
    expect(root?.getAttribute("data-stub")).toBeNull();
  });

  it("shows exactly four core cells", () => {
    const { container } = render(<ExpandedView tick={expandedTick} />);
    const cells = container.querySelectorAll("[data-testid^='core-cell-']");
    expect(cells).toHaveLength(4);
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
    const { container } = render(<ExpandedView tick={expandedTick} />);
    const text = container.textContent;
    expect(text).toContain("Intel Core i7-3770K · 4C/8T");
    expect(text).toContain("3.4 / 6.0 GB");
    expect(text).toContain("LIVE · updates every 1s");
    expect(text).toContain("°C · 60s window");
  });

  it("no-nvml: GPU dashes and no bare zero", () => {
    const { container } = render(<ExpandedView tick={noNvmlTick} />);
    const gpu = container.querySelector('[data-testid="gpu-section"]');
    const gpuText = gpu?.textContent ?? "";
    expect(gpuText).toContain("—");
    expect(
      gpu?.querySelector('[data-testid="vram-block"]')?.textContent,
    ).not.toMatch(/\b0\b/);
    expect(container.querySelector('[data-testid="vram-bar-fill"]')).toBeNull();
  });

  it("no-pawnio: PACKAGE/POWER/core temps dash; loads and sparkline remain", () => {
    const { container } = render(<ExpandedView tick={noPawnioTick} />);
    const cpu = container.querySelector('[data-testid="cpu-section"]');
    expect(cpu?.textContent).toContain("—");
    expect(cpu?.textContent).toMatch(/35%/);
    expect(cpu?.querySelectorAll("[data-testid^='core-cell-']")).toHaveLength(
      4,
    );
    expect(cpu?.querySelector('[data-testid="sparkline"]')).not.toBeNull();
  });

  it.each<[IntervalMs, number]>([
    [1000, 60],
    [2000, 30],
    [5000, 12],
  ])("sparkline uses %s points at %sms interval", (intervalMs, expected) => {
    const tick: SensorTick = {
      ...expandedTick,
      intervalMs,
      history: {
        cpuLoad: sliceHistory(expandedTick.history.cpuLoad, intervalMs),
        gpuLoad: sliceHistory(expandedTick.history.gpuLoad, intervalMs),
      },
    };
    const cpuHtml = sparklineHtml(tick, "cpu");
    expect(polylinePointCount(cpuHtml)).toBe(expected);
    const { container } = render(<ExpandedView tick={tick} />);
    const footer = container.querySelector('[data-testid="expanded-footer"]');
    expect(footer?.textContent).toContain(
      `updates every ${intervalMs === 1000 ? "1s" : intervalMs === 2000 ? "2s" : "5s"}`,
    );
  });

  it("collapse requests compact view", () => {
    const { getByLabelText } = render(<ExpandedView tick={expandedTick} />);
    fireEvent.click(getByLabelText("Collapse"));
    expect(setView).toHaveBeenCalledWith("compact");
  });
});
