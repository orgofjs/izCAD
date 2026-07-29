import { describe, expect, it } from "vitest";
import {
  restoreDxfLayerStates,
  type SavedDwgLayerStates,
} from "./layerVisibility";

function layerTable(
  firstColor: number,
  firstFlags: number,
  secondColor: number,
): Uint8Array {
  return new TextEncoder().encode(
    [
      "0",
      "SECTION",
      "2",
      "TABLES",
      "0",
      "TABLE",
      "2",
      "LAYER",
      "0",
      "LAYER",
      "2",
      "VISIBLE",
      "70",
      `  ${firstFlags}`,
      "62",
      `  ${firstColor}`,
      "0",
      "LAYER",
      "2",
      "OFF",
      "70",
      "  0",
      "62",
      `  ${secondColor}`,
      "0",
      "ENDTAB",
      "0",
      "ENDSEC",
      "0",
      "LINE",
      "62",
      "-5",
      "0",
      "EOF",
      "",
    ].join("\r\n"),
  );
}

function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

describe("DWG layer visibility restoration", () => {
  it("restores on, off and frozen states from the source DWG", () => {
    const states: SavedDwgLayerStates = new Map([
      [
        "VISIBLE",
        {
          off: false,
          frozen: false,
          frozenInNewViewport: false,
        },
      ],
      [
        "OFF",
        {
          off: true,
          frozen: true,
          frozenInNewViewport: true,
        },
      ],
    ]);

    const restored = decode(
      restoreDxfLayerStates(layerTable(-7, 3, 4), states),
    );

    expect(restored).toContain("62\r\n  7");
    expect(restored).toContain("70\r\n  3\r\n62\r\n  -4");
  });

  it("falls back to visible layers when raw states are unavailable", () => {
    const restored = decode(
      restoreDxfLayerStates(layerTable(-7, 0, -4), null),
    );

    expect(restored).toContain("62\r\n  7");
    expect(restored).toContain("62\r\n  4");
  });

  it("does not alter entity colors outside the layer table", () => {
    const restored = decode(
      restoreDxfLayerStates(layerTable(-7, 0, -4), null),
    );

    expect(restored).toContain("0\r\nLINE\r\n62\r\n-5");
  });
});
