import { describe, expect, it } from "vitest";
import {
  detectDrawingFormat,
  getFileExtension,
  replaceExtension,
} from "./fileTypes";

describe("drawing file types", () => {
  it("detects supported extensions without case sensitivity", () => {
    expect(detectDrawingFormat("floor-plan.DXF")).toBe("dxf");
    expect(detectDrawingFormat("model.DwG")).toBe("dwg");
  });

  it("rejects missing and unsupported extensions", () => {
    expect(detectDrawingFormat("drawing")).toBeNull();
    expect(detectDrawingFormat("drawing.pdf")).toBeNull();
  });

  it("replaces only the final extension", () => {
    expect(replaceExtension("building.v2.dwg", "dxf")).toBe(
      "building.v2.dxf",
    );
  });

  it("returns an empty extension for malformed names", () => {
    expect(getFileExtension("drawing.")).toBe("");
  });
});

