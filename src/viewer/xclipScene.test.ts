import { describe, expect, it } from "vitest";
import { Matrix3 } from "three";
import { installXclipScenePreparation } from "./xclipScene";

class FakeDxfScene {
  blocks = new Map<string, any>();
  layers = new Map<string, Record<string, unknown>>([
    ["0", { name: "0", color: 0xffffff }],
  ]);
  izcadXclips?: Record<string, Array<{ x: number; y: number }>>;
  izcadNestedXclips?: Record<
    string,
    {
      rootBlockName: string;
      points: Array<{ x: number; y: number }>;
    }
  >;
  izcadNestedClipSequence?: number;
  processedLayers: Array<string | null> = [];

  async Build(dxf: {
    blocks: Record<string, { name: string; entities?: object[] }>;
  }): Promise<void> {
    for (const block of Object.values(dxf.blocks)) {
      this.blocks.set(block.name, {
        flatten: true,
        offset: { x: 3, y: 4 },
        data: block,
      });
    }
    this._ProcessInsert(
      (dxf as { entities?: object[] }).entities?.[0] ?? {},
    );
    this._BuildScene();
  }

  _ProcessInsert(
    _entity: object,
    _blockContext?: unknown,
  ): void {}

  _ProcessDxfEntity(
    entity: { layer?: string },
    blockContext?: unknown,
  ): void {
    this.processedLayers.push(
      this._GetEntityLayer(entity, blockContext),
    );
  }

  _GetEntityLayer(
    entity: { layer?: string },
    blockContext?: unknown,
  ): string | null {
    return entity.layer ?? (blockContext ? null : "0");
  }

  _BuildScene(): object {
    return {};
  }
}

function clippedInsert() {
  return {
    blocks: {
      BLOCK_A: { name: "BLOCK_A", position: { x: 0, y: 0 } },
    },
    entities: [
      {
        type: "INSERT",
        handle: "A1",
        name: "BLOCK_A",
        xdata: {
          IZCAD_XCLIP: {
            values: [
              { code: 1000, value: "10,20;50,80" },
            ],
          },
        },
      },
    ],
  };
}

describe("XCLIP scene preparation", () => {
  it("gives a clipped insert an individual non-flattened block", async () => {
    installXclipScenePreparation(FakeDxfScene);
    const scene = new FakeDxfScene();
    const dxf = clippedInsert();

    await scene.Build(dxf);

    expect(dxf.entities[0].name).toBe("__IZCAD_XCLIP_A1");
    expect(
      scene.blocks.get("__IZCAD_XCLIP_A1")?.flatten,
    ).toBe(false);
  });

  it("keeps clipping active for a nested block's own batches", async () => {
    installXclipScenePreparation(FakeDxfScene);
    const scene = new FakeDxfScene();
    scene.izcadNestedXclips = {};
    scene.izcadNestedClipSequence = 0;
    const parent = {
      flatten: false,
      offset: { x: 0, y: 0 },
      data: { name: "PARENT" },
    };
    const child = {
      flatten: false,
      offset: { x: 0, y: 0 },
      data: {
        name: "CHILD",
        entities: [{ type: "LINE", layer: "0" }],
      },
    };
    scene.blocks.set("PARENT", parent);
    scene.blocks.set("CHILD", child);
    const parentContext: any = {
      name: "PARENT",
      block: parent,
      transform: new Matrix3(),
      NestedBlockContext() {
        return {
          name: "CHILD",
          block: parent,
          transform: new Matrix3(),
          NestedBlockContext: this.NestedBlockContext,
        };
      },
    };

    scene._ProcessInsert(
      {
        type: "INSERT",
        handle: "N1",
        name: "CHILD",
        xdata: {
          IZCAD_XCLIP: {
            values: [{ code: 1000, value: "0,0;10,10" }],
          },
        },
      },
      parentContext,
    );

    expect(scene.processedLayers[0]).toMatch(
      /^__IZCAD_NESTED_XCLIP_/,
    );
    expect(Object.values(scene.izcadNestedXclips)).toEqual([
      {
        rootBlockName: "PARENT",
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
      },
    ]);
  });
});
