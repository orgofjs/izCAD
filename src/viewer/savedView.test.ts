import { describe, expect, it } from "vitest";
import {
  normalizeSavedDrawingView,
  resolveSavedDrawingView,
  type DrawingBounds,
} from "./savedView";

const bounds: DrawingBounds = {
  minX: 0,
  minY: 0,
  maxX: 100,
  maxY: 100,
};

describe("saved drawing view", () => {
  it("preserves the complete saved desktop view on a phone canvas", () => {
    const resolved = resolveSavedDrawingView(
      {
        center: { x: 60, y: 40 },
        viewHeight: 40,
        aspectRatio: 2.5,
      },
      bounds,
      { x: 10, y: 5 },
      0.5,
    );

    expect(resolved).toEqual({
      center: { x: 50, y: 35 },
      width: 100,
    });
  });

  it("uses the current canvas when it is wider than the saved view", () => {
    const resolved = resolveSavedDrawingView(
      {
        center: { x: 50, y: 50 },
        viewHeight: 40,
        aspectRatio: 1,
      },
      bounds,
      { x: 0, y: 0 },
      2,
    );

    expect(resolved?.width).toBe(80);
  });

  it("rejects a saved view that is outside the drawing", () => {
    expect(
      resolveSavedDrawingView(
        {
          center: { x: 500, y: 500 },
          viewHeight: 20,
        },
        bounds,
        { x: 0, y: 0 },
        1,
      ),
    ).toBeNull();
  });

  it("rejects invalid view heights", () => {
    expect(
      normalizeSavedDrawingView({
        center: { x: 10, y: 10 },
        viewHeight: 0,
      }),
    ).toBeNull();
  });
});
