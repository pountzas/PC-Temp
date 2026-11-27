import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const confPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../src-tauri/tauri.conf.json",
);

describe("tauri.conf.json windows", () => {
  const conf = JSON.parse(readFileSync(confPath, "utf8")) as {
    app: { windows: { label: string; theme?: string }[] };
  };

  it.each(["widget", "settings"])(
    "pins %s window Mica to the dark theme",
    (label) => {
      const win = conf.app.windows.find((w) => w.label === label);
      expect(win?.theme).toBe("Dark");
    },
  );
});