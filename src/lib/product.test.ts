import { describe, expect, it } from "vitest";
import { PRODUCT_IDENTIFIER, PRODUCT_NAME } from "./product";

describe("product identity", () => {
  it("uses the PC-Temp product name and bundle identifier", () => {
    expect(PRODUCT_NAME).toBe("PC-Temp");
    expect(PRODUCT_IDENTIFIER).toBe("com.pountzas.pctemp");
  });
});