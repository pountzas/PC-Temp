// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SENSORS } from "./events";
import { FIXTURES } from "./mock/fixtures";
import type { SensorTick } from "./types";
import { useSensors } from "./useSensors";

const { listen, getSnapshot, startMockSensorEmitter, tauriMock } = vi.hoisted(
  () => ({
    listen: vi.fn(),
    getSnapshot: vi.fn(),
    startMockSensorEmitter: vi.fn(),
    tauriMock: {
      isTauri: vi.fn(() => true),
      mockSensorsEnabled: vi.fn(() => false),
    },
  }),
);

vi.mock("@tauri-apps/api/event", () => ({ listen }));
vi.mock("./commands", () => ({ getSnapshot }));
vi.mock("./mock/emitter", () => ({ startMockSensorEmitter }));
vi.mock("./tauri", () => tauriMock);

type SensorHandler = (event: { payload: unknown }) => void;

function defined<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`${label} is undefined`);
  }
  return value;
}

describe("useSensors", () => {
  let sensorHandler: SensorHandler | undefined;
  let resolveSnapshot: ((tick: SensorTick | null) => void) | undefined;

  beforeEach(() => {
    sensorHandler = undefined;
    tauriMock.isTauri.mockReturnValue(true);
    tauriMock.mockSensorsEnabled.mockReturnValue(false);
    startMockSensorEmitter.mockReturnValue(() => {});
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
      defined(sensorHandler, "sensorHandler")({ payload: newer });
    });

    expect(result.current?.ts).toBe(200);

    await act(async () => {
      defined(resolveSnapshot, "resolveSnapshot")(older);
      await Promise.resolve();
    });

    expect(result.current?.ts).toBe(200);
  });

  it("applies getSnapshot when no sensors event arrived yet", async () => {
    const snapshot: SensorTick = { ...FIXTURES.compact, ts: 300 };

    const { result } = renderHook(() => useSensors());

    await waitFor(() => {
      expect(resolveSnapshot).toBeDefined();
    });

    await act(async () => {
      defined(resolveSnapshot, "resolveSnapshot")(snapshot);
      await Promise.resolve();
    });

    expect(result.current?.ts).toBe(300);
  });

  it("passes intervalMs to startMockSensorEmitter when not in Tauri", async () => {
    tauriMock.isTauri.mockReturnValue(false);

    renderHook(() => useSensors(2000));

    await waitFor(() => {
      expect(startMockSensorEmitter).toHaveBeenCalledWith(
        expect.any(Function),
        2000,
      );
    });
    expect(listen).not.toHaveBeenCalled();
  });
});
