// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PillView } from "./PillView";

const { startDrag } = vi.hoisted(() => ({ startDrag: vi.fn() }));

vi.mock("../../window/drag", () => ({ startDrag }));
vi.mock("../../ipc/useSettings", () => ({
  useSettings: () => ({ units: "C" as const }),
}));

beforeEach(() => {
  cleanup();
});

afterEach(() => {
  cleanup();
});

describe("PillView grip + null tick", () => {
  it("starts a native window drag on grip mousedown", () => {
    const { getByTestId } = render(<PillView tick={null} />);
    fireEvent.mouseDown(getByTestId("pill-grip"), { button: 0 });
    expect(startDrag).toHaveBeenCalledTimes(1);
  });

  it("renders em dashes and no load fill before the first tick", () => {
    const { container, queryAllByTestId } = render(<PillView tick={null} />);
    expect(container.textContent).toContain("CPU—");
    expect(container.textContent).toContain("GPU—");
    expect(container.textContent).not.toContain("°");
    expect(queryAllByTestId("pill-load-fill")).toHaveLength(0);
    expect(queryAllByTestId("pill-load-track")).toHaveLength(2);
  });
});
