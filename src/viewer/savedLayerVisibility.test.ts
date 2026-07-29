import { describe, expect, it } from "vitest";
import { installSavedLayerVisibility } from "./savedLayerVisibility";

type FakeEntity = {
  layer: string;
  rejectedByViewer?: boolean;
};

class FakeDxfScene {
  public layers = new Map([
    ["VISIBLE", { visible: true }],
    ["OFF", { visible: false }],
    ["UNSPECIFIED", {}],
  ]);

  public _FilterEntity(entity: FakeEntity): boolean {
    return !entity.rejectedByViewer;
  }

  public _GetEntityLayer(entity: FakeEntity): string {
    return entity.layer;
  }
}

describe("saved DXF layer visibility", () => {
  it("filters layers saved as off", () => {
    installSavedLayerVisibility(FakeDxfScene);
    const scene = new FakeDxfScene();

    expect(scene._FilterEntity({ layer: "OFF" })).toBe(false);
    expect(scene._FilterEntity({ layer: "VISIBLE" })).toBe(true);
    expect(scene._FilterEntity({ layer: "UNSPECIFIED" })).toBe(true);
  });

  it("preserves the viewer's existing entity filters", () => {
    installSavedLayerVisibility(FakeDxfScene);
    const scene = new FakeDxfScene();

    expect(
      scene._FilterEntity({
        layer: "VISIBLE",
        rejectedByViewer: true,
      }),
    ).toBe(false);
  });

  it("keeps layer 0 inheritance behavior and patches only once", () => {
    installSavedLayerVisibility(FakeDxfScene);
    installSavedLayerVisibility(FakeDxfScene);
    const scene = new FakeDxfScene();
    scene.layers.set("0", { visible: false });

    expect(scene._FilterEntity({ layer: "0" })).toBe(true);
  });
});
