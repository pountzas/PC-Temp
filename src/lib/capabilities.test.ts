import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const capabilitiesPath = resolve(
  process.cwd(),
  "src-tauri/capabilities/default.json",
);

describe("default capabilities", () => {
  it("targets widget and settings with the issue #2 permission set", () => {
    const json = JSON.parse(readFileSync(capabilitiesPath, "utf8")) as {
      windows: string[];
      permissions: string[];
    };

    expect(json.windows).toEqual(["widget", "settings"]);
    expect(json.permissions).toEqual([
      "core:default",
      "core:window:allow-start-dragging",
      "core:window:allow-set-size",
      "core:window:allow-set-position",
      "core:window:allow-set-always-on-top",
      "core:window:allow-set-ignore-cursor-events",
      "core:window:allow-hide",
      "core:window:allow-close",
      "core:window:allow-show",
      "core:window:allow-set-focus",
      "store:default",
    ]);
  });
});