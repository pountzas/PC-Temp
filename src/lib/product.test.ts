import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CRATE_NAME, PRODUCT_IDENTIFIER, PRODUCT_NAME } from "./product";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const conf = JSON.parse(read("src-tauri/tauri.conf.json"));
const pkg = JSON.parse(read("package.json"));
const cargo = read("src-tauri/Cargo.toml");

const windowFlags = {
  transparent: true,
  decorations: false,
  alwaysOnTop: true,
  skipTaskbar: true,
  resizable: false,
  shadow: true,
  windowEffects: { effects: ["mica"] },
};

describe("product identity", () => {
  it("matches tauri.conf.json, package.json and Cargo.toml", () => {
    expect(conf.productName).toBe(PRODUCT_NAME);
    expect(conf.identifier).toBe(PRODUCT_IDENTIFIER);
    expect(pkg.name).toBe(CRATE_NAME);
    expect(cargo).toMatch(/^name = "pc-temp"$/m);
    expect(cargo).toMatch(/^name = "pc_temp_lib"$/m);
  });

  it("declares the widget and hidden settings windows", () => {
    const [widget, settings] = conf.app.windows;
    expect(widget).toMatchObject({
      label: "widget",
      title: "PC-Temp",
      width: 320,
      height: 200,
      ...windowFlags,
    });
    expect(settings).toMatchObject({
      label: "settings",
      title: "PC-Temp Settings",
      width: 320,
      height: 358,
      visible: false,
      url: "settings.html",
      ...windowFlags,
    });
  });
});