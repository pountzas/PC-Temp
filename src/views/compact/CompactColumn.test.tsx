import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FIXTURES } from "../../ipc/mock/fixtures";
import { CompactColumn } from "./CompactColumn";

describe("CompactColumn", () => {
  it("renders compact fixture load and model names", () => {
    const tick = FIXTURES.compact;
    const html = renderToStaticMarkup(
      <>
        <CompactColumn
          component="cpu"
          loadPct={tick.cpu.loadPct}
          tempC={tick.cpu.packageTempC}
          modelName={tick.cpu.name}
          units="C"
          tick={tick}
        />
        <CompactColumn
          component="gpu"
          loadPct={tick.gpu.loadPct}
          tempC={tick.gpu.coreTempC}
          modelName={tick.gpu.name}
          units="C"
          tick={tick}
        />
      </>,
    );
    expect(html).toContain("i7-3770K");
    expect(html).toContain("GTX 980 Ti");
    expect(html).toContain(">52<");
    expect(html).toContain(">64<");
    expect(html).toContain(">34<");
    expect(html).toContain(">58<");
  });

  it("shows em dash for null CPU temp and omits bar fill", () => {
    const tick = FIXTURES["no-pawnio"];
    const html = renderToStaticMarkup(
      <CompactColumn
        component="cpu"
        loadPct={tick.cpu.loadPct}
        tempC={tick.cpu.packageTempC}
        modelName={tick.cpu.name}
        units="C"
        tick={tick}
      />,
    );
    expect(html).toContain("—");
    expect(html).not.toContain('data-testid="temp-bar-fill"');
    expect(html).not.toContain(">0<");
    expect(html).toContain(">41<");
  });

  it("uses warm colour when tick alerts mark gpu warn", () => {
    const tick = FIXTURES.warn;
    const html = renderToStaticMarkup(
      <CompactColumn
        component="gpu"
        loadPct={tick.gpu.loadPct}
        tempC={tick.gpu.coreTempC}
        modelName={tick.gpu.name}
        units="C"
        tick={tick}
      />,
    );
    expect(html).toContain('data-temp-level="warn"');
    expect(html).toContain("color:var(--color-warm)");
  });

  it("uses hot colour when tick alerts mark gpu hot", () => {
    const tick = FIXTURES.hot;
    const html = renderToStaticMarkup(
      <CompactColumn
        component="gpu"
        loadPct={tick.gpu.loadPct}
        tempC={tick.gpu.coreTempC}
        modelName={tick.gpu.name}
        units="C"
        tick={tick}
      />,
    );
    expect(html).toContain('data-temp-level="hot"');
    expect(html).toContain("color:var(--color-hot)");
  });
});
