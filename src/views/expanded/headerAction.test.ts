import { describe, expect, it } from "vitest";
import { runHeaderAction } from "./headerAction";

describe("runHeaderAction", () => {
  it("swallows rejected promises", async () => {
    runHeaderAction(() => Promise.reject(new Error("ipc")));
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 0);
    });
  });

  it("swallows sync throws", () => {
    expect(() => {
      runHeaderAction(() => {
        throw new Error("boom");
      });
    }).not.toThrow();
  });
});
