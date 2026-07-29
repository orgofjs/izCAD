import { describe, expect, it } from "vitest";
import {
  createUniqueEntryName,
  isValidEntryName,
  normalizeEntryName,
} from "./drawingLibrary";

describe("drawing library names", () => {
  it("normalizes surrounding and repeated whitespace", () => {
    expect(normalizeEntryName("  Project   Plans  ")).toBe("Project Plans");
  });

  it("rejects empty, path-like, and control-character names", () => {
    expect(isValidEntryName(" ")).toBe(false);
    expect(isValidEntryName("..")).toBe(false);
    expect(isValidEntryName("floor/plan")).toBe(false);
    expect(isValidEntryName("floor\u0000plan")).toBe(false);
  });

  it("keeps drawing extensions when making a unique name", () => {
    expect(
      createUniqueEntryName("floor.dwg", ["FLOOR.DWG", "floor (2).dwg"]),
    ).toBe("floor (3).dwg");
  });

  it("creates unique folder names without treating dots as extensions", () => {
    expect(createUniqueEntryName("Project", ["project"])).toBe("Project (2)");
  });
});
