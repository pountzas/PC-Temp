import type { MouseEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { isTauri } from "../ipc/tauri";
import { startDrag } from "./drag";

const startDragging = vi.fn(() => Promise.resolve());

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ startDragging }),
}));

vi.mock("../ipc/tauri", () => ({
  isTauri: vi.fn(() => true),
}));

function targetInsideButton(isButton: boolean): Element {
  return {
    closest(selector: string) {
      if (isButton && selector === "button") {
        return {} as Element;
      }
      return null;
    },
  } as unknown as Element;
}

function mouseEvent(button: number, isButton: boolean): MouseEvent {
  return {
    button,
    target: targetInsideButton(isButton),
  } as unknown as MouseEvent;
}

describe("startDrag", () => {
  it("starts dragging on primary button outside buttons", () => {
    startDragging.mockClear();
    startDrag(mouseEvent(0, false));
    expect(startDragging).toHaveBeenCalledOnce();
  });

  it("ignores non-primary buttons", () => {
    startDragging.mockClear();
    startDrag(mouseEvent(2, false));
    expect(startDragging).not.toHaveBeenCalled();
  });

  it("does not drag when mousedown starts on a button", () => {
    startDragging.mockClear();
    startDrag(mouseEvent(0, true));
    expect(startDragging).not.toHaveBeenCalled();
  });

  it("does not call startDragging when not in Tauri", () => {
    startDragging.mockClear();
    vi.mocked(isTauri).mockReturnValueOnce(false);
    startDrag(mouseEvent(0, false));
    expect(startDragging).not.toHaveBeenCalled();
  });
});