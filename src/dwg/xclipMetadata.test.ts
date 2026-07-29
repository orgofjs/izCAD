import { describe, expect, it } from "vitest";
import DxfParser from "dxf-viewer/src/parser/DxfParser.js";
import {
  annotateDxfXclips,
  parseDxfXclip,
} from "./xclipMetadata";

function fixture(): Uint8Array {
  return new TextEncoder().encode(
    [
      "0", "SECTION", "2", "ENTITIES",
      "0", "INSERT", "5", "A1",
      "102", "{ACAD_XDICTIONARY", "360", "D1", "102", "}",
      "2", "BLOCK_A", "10", "0", "20", "0", "30", "0",
      "0", "ENDSEC",
      "0", "SECTION", "2", "OBJECTS",
      "0", "DICTIONARY", "5", "D1", "3", "ACAD_FILTER", "360", "D2",
      "0", "DICTIONARY", "5", "D2", "3", "SPATIAL", "360", "F1",
      "0", "SPATIAL_FILTER", "5", "F1", "70", "2",
      "10", "10", "20", "20", "10", "50", "20", "80",
      "0", "ENDSEC", "0", "EOF", "",
    ].join("\r\n"),
  );
}

describe("DWG XCLIP metadata preservation", () => {
  it("copies a resolved spatial filter onto its INSERT as XDATA", () => {
    const annotated = new TextDecoder().decode(
      annotateDxfXclips(fixture()),
    );

    expect(annotated).toContain(
      "1001\r\nIZCAD_XCLIP\r\n1000\r\n10,20;50,80",
    );
  });

  it("can read the annotation after dxf-viewer parsing", () => {
    const parsed = new DxfParser().parseSync(
      new TextDecoder().decode(annotateDxfXclips(fixture())),
    );
    const insert = parsed.entities.find(
      (entity: { type?: string }) => entity.type === "INSERT",
    );
    expect(insert).toBeDefined();
    if (!insert) {
      throw new Error("INSERT fixture was not parsed.");
    }

    expect(parseDxfXclip(insert)).toEqual([
      { x: 10, y: 20 },
      { x: 50, y: 80 },
    ]);
  });
});
