import { describe, expect, it } from "vitest";
import {
  classifyEngineError,
  engineErrorName,
  inspectDwgInput,
  isLikelyMemoryError,
} from "./diagnostics";

function bufferWithHeader(header: string): ArrayBuffer {
  return new TextEncoder().encode(`${header}rest-of-file`).buffer;
}

describe("DWG diagnostics", () => {
  it("identifies a known DWG version without reading file metadata", () => {
    expect(inspectDwgInput(bufferWithHeader("AC1032"))).toEqual({
      engine: "libredwg",
      version: "AC1032 (AutoCAD 2018 format)",
      fileSizeBytes: 18,
    });
  });

  it("marks a non-DWG header as unknown", () => {
    expect(
      inspectDwgInput(new Uint8Array([0, 1, 2]).buffer).version,
    ).toBe("UNKNOWN");
  });

  it("maps native parser failures to user-facing categories", () => {
    expect(classifyEngineError(8192)).toBe("DWG_MEMORY_LIMIT");
    expect(classifyEngineError(2048)).toBe(
      "DWG_CORRUPT_OR_ENCRYPTED",
    );
    expect(classifyEngineError(2)).toBe("DWG_PARSE_FAILED");
    expect(engineErrorName(6)).toBe(
      "NOTYETSUPPORTED|UNHANDLEDCLASS",
    );
  });

  it("recognizes common WebAssembly memory failures", () => {
    expect(
      isLikelyMemoryError(new Error("Cannot enlarge memory arrays")),
    ).toBe(true);
    expect(isLikelyMemoryError(new Error("invalid file"))).toBe(false);
  });
});
