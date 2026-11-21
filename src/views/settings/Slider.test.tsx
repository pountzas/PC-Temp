// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Slider } from "./Slider";

describe("Slider", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("shows local draft immediately but throttles onChange by 100ms", () => {
    const onChange = vi.fn();
    render(<Slider label="Opacity" value={72} onChange={onChange} />);

    const slider = screen.getByLabelText("Opacity slider");
    fireEvent.change(slider, { target: { value: "40" } });

    expect(screen.getByText("40%")).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(onChange).toHaveBeenCalledWith(40);
  });

  it("follows the controlled value prop after settings-changed", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <Slider label="Opacity" value={72} onChange={onChange} />,
    );

    rerender(<Slider label="Opacity" value={55} onChange={onChange} />);
    expect(screen.getByText("55%")).toBeTruthy();
  });
});
