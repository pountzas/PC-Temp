import { describe, expect, it } from "vitest";
import {
  decideDock,
  DOCK_PX,
  PILL_LOGICAL_HEIGHT,
  PILL_LOGICAL_WIDTH,
  type PhysicalRect,
  UNDOCK_PX,
} from "./dock";

function rect(
  x: number,
  y: number,
  width: number,
  height: number,
): PhysicalRect {
  return { x, y, width, height };
}

function work(w: number, h = 1040, x = 0, y = 0): PhysicalRect {
  return rect(x, y, w, h);
}

describe("decideDock", () => {
  const scale = 1;
  const compactW = 320;
  const compactH = 200;

  it("docks compact when the right edge is within DOCK_PX of the work area", () => {
    const workArea = work(1920);
    const windowRect = rect(1920 - compactW - 10, 200, compactW, compactH);
    const result = decideDock(windowRect, workArea, { view: "compact" }, scale);
    expect(result.action).toBe("dock");
    if (result.action === "dock") {
      expect(result.x).toBe(workArea.x + workArea.width - PILL_LOGICAL_WIDTH);
      expect(result.y).toBe(200);
    }
  });

  it("stays undocked when the right edge is farther than DOCK_PX away", () => {
    const workArea = work(1920);
    const windowRect = rect(1400, 200, compactW, compactH);
    const result = decideDock(
      windowRect,
      workArea,
      { view: "expanded" },
      scale,
    );
    expect(result.action).toBe("stay");
  });

  it("undocks the pill when dragged more than UNDOCK_PX from the right edge", () => {
    const workArea = work(1920);
    const pillW = PILL_LOGICAL_WIDTH;
    const windowRect = rect(
      workArea.x + workArea.width - pillW - UNDOCK_PX - 1,
      100,
      pillW,
      PILL_LOGICAL_HEIGHT,
    );
    const result = decideDock(windowRect, workArea, { view: "pill" }, scale);
    expect(result.action).toBe("undock");
  });

  it("stays docked when the pill remains within UNDOCK_PX of the right edge", () => {
    const workArea = work(1920);
    const pillW = PILL_LOGICAL_WIDTH;
    const windowRect = rect(
      workArea.x + workArea.width - pillW - 5,
      100,
      pillW,
      PILL_LOGICAL_HEIGHT,
    );
    const result = decideDock(windowRect, workArea, { view: "pill" }, scale);
    expect(result.action).toBe("stay");
  });

  it("docks on the second monitor work area right edge", () => {
    const workArea = work(1920, 1080, 1920, 0);
    const windowRect = rect(3840 - compactW - 8, 300, compactW, compactH);
    const result = decideDock(windowRect, workArea, { view: "compact" }, scale);
    expect(result.action).toBe("dock");
    if (result.action === "dock") {
      expect(result.x).toBe(workArea.x + workArea.width - PILL_LOGICAL_WIDTH);
    }
  });

  it("stays undocked when flush against the left edge", () => {
    const workArea = work(1920);
    const windowRect = rect(workArea.x, 200, compactW, compactH);
    const result = decideDock(windowRect, workArea, { view: "compact" }, scale);
    expect(result.action).toBe("stay");
  });

  it("stays undocked when flush against the top edge", () => {
    const workArea = work(1920);
    const windowRect = rect(500, workArea.y, compactW, compactH);
    const result = decideDock(windowRect, workArea, { view: "compact" }, scale);
    expect(result.action).toBe("stay");
  });

  it("stays undocked when flush against the bottom edge", () => {
    const workArea = work(1920);
    const windowRect = rect(
      500,
      workArea.y + workArea.height - compactH,
      compactW,
      compactH,
    );
    const result = decideDock(windowRect, workArea, { view: "compact" }, scale);
    expect(result.action).toBe("stay");
  });

  it("clamps Y into the work area when docking", () => {
    const workArea = work(1920, 1040);
    const windowRect = rect(1920 - compactW - 5, 5000, compactW, compactH);
    const result = decideDock(windowRect, workArea, { view: "compact" }, scale);
    expect(result.action).toBe("dock");
    if (result.action === "dock") {
      const pillH = PILL_LOGICAL_HEIGHT * scale;
      expect(result.y).toBe(workArea.y + workArea.height - pillH);
    }
  });

  it("uses physical pill width at 150% scaling", () => {
    const scaleFactor = 1.5;
    const workArea = work(2880);
    const compactPhysW = Math.round(compactW * scaleFactor);
    const windowRect = rect(
      2880 - compactPhysW - DOCK_PX,
      200,
      compactPhysW,
      300,
    );
    const result = decideDock(
      windowRect,
      workArea,
      { view: "compact" },
      scaleFactor,
    );
    expect(result.action).toBe("dock");
    if (result.action === "dock") {
      const pillW = PILL_LOGICAL_WIDTH * scaleFactor;
      expect(result.x).toBe(workArea.x + workArea.width - pillW);
    }
  });
});
