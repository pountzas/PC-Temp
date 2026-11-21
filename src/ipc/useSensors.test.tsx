// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SENSORS } from "./events";
import { FIXTURES } from "./mock/fixtures";
import type { SensorTick } from "./types";
import { useSensors } from "./useSensors";

const { listen, getSnapshot } = vi.hoisted(() => ({
  listen: vi.fn(),
  getSnapshot: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({ listen }));
vi.mock("./commands", () => ({ getSnapshot }));
vi.mock("./tauri", () => ({
  isTauri: () => true,
  mockSensorsEnabled: () => false,
}));
vi.mock("./useSettings", () => ({
  useSettings: () => ({ intervalMs: 1000 }),
}));

type SensorHandler = (event: { payload: unknown }) => void;

describe("useSensors", () => {
  let sensorHandler: SensorHandler | undefined;
  let resolveSnapshot: ((tick: SensorTick | null) => void) | undefined;

  beforeEach(() => {
    sensorHandler = undefined;
    listen.mockImplementation(async (event: string, handler: SensorHandler) => {
      if (event === SENSORS) {
        sensorHandler = handler;
      }
      return () => {};
    });
    getSnapshot.mockImplementation(
      () =>
        new Promise<SensorTick | null>((resolve) => {
          resolveSnapshot = resolve;
        }),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("keeps a newer sensors event when getSnapshot resolves with an older tick", async () => {
    const older: SensorTick = { ...FIXTURES.compact, ts: 100 };
    const newer: SensorTick = { ...FIXTURES.hot, ts: 200 };

    const { result } = renderHook(() => useSensors());

    await waitFor(() => {
      expect(sensorHandler).toBeDefined();
    });

    act(() => {
      sensorHandler!({ payload: newer });
    });

    expect(result.current?.ts).toBe(200);

    await act(async () => {
      resolveSnapshot!(older);
      await Promise.resolve();
    });

    expect(result.current?.ts).toBe(200);
  });
});