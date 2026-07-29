import {
  parseDxfXclip,
  type DxfClipPoint,
} from "../dwg/xclipMetadata";
import { Vector2, type Matrix3 } from "three";

type DxfInsert = {
  type?: string;
  handle?: string | number;
  name?: string;
  xdata?: Record<
    string,
    { values?: Array<{ code: number; value: unknown }> }
  >;
};

type DxfBlock = {
  name: string;
  entities?: DxfInsert[];
  [key: string]: unknown;
};

type ParsedDxf = {
  entities?: DxfInsert[];
  blocks?: Record<string, DxfBlock>;
};

export type SerializedXclip = {
  points: DxfClipPoint[];
  blockOffset: DxfClipPoint;
};

type SerializedScene = {
  izcadXclips?: Record<string, SerializedXclip>;
  izcadNestedXclips?: Record<string, SerializedXclip>;
};

type SceneBlock = {
  flatten: boolean;
  offset: { x: number; y: number } | null;
  data: DxfBlock;
};

type BlockContext = {
  name: string;
  block: SceneBlock;
  transform: Matrix3;
  izcadNestedClip?: string;
  NestedBlockContext(
    block: SceneBlock,
    entity: DxfInsert,
  ): BlockContext;
};

type DxfSceneInstance = {
  blocks: Map<string, SceneBlock>;
  layers: Map<string, Record<string, unknown>>;
  izcadXclips?: Record<string, DxfClipPoint[]>;
  izcadNestedXclips?: Record<
    string,
    {
      rootBlockName: string;
      points: DxfClipPoint[];
    }
  >;
  izcadNestedClipSequence?: number;
  Build(
    dxf: ParsedDxf,
    fontFetchers: unknown,
  ): Promise<void>;
  _BuildScene(): SerializedScene;
  _GetEntityLayer(
    entity: DxfInsert,
    blockContext?: BlockContext | null,
  ): string | null;
  _ProcessDxfEntity(
    entity: DxfInsert,
    blockContext?: BlockContext,
  ): void;
  _ProcessInsert(
    entity: DxfInsert,
    blockContext?: BlockContext | null,
  ): void;
};

type DxfSceneConstructor = {
  prototype: DxfSceneInstance;
};

const XCLIP_BLOCK_PREFIX = "__IZCAD_XCLIP_";
const NESTED_XCLIP_LAYER_PREFIX = "__IZCAD_NESTED_XCLIP_";
const patchedConstructors = new WeakSet<object>();

function findBlock(
  blocks: Record<string, DxfBlock>,
  name: string,
): DxfBlock | undefined {
  return Object.values(blocks).find(
    (block) => block.name === name,
  );
}

function prepareTopLevelXclips(
  dxf: ParsedDxf,
): Record<string, DxfClipPoint[]> {
  const blocks = dxf.blocks;
  if (!blocks) {
    return {};
  }

  const clips: Record<string, DxfClipPoint[]> = {};
  for (const entity of dxf.entities ?? []) {
    if (entity.type !== "INSERT" || !entity.name) {
      continue;
    }

    const points = parseDxfXclip(entity);
    const sourceBlock = points
      ? findBlock(blocks, entity.name)
      : undefined;
    if (!points || !sourceBlock) {
      continue;
    }

    const handle = String(entity.handle ?? Object.keys(clips).length);
    const alias = `${XCLIP_BLOCK_PREFIX}${handle}`;
    blocks[alias] = {
      ...sourceBlock,
      name: alias,
    };
    entity.name = alias;
    clips[alias] = points;
  }

  return clips;
}

/**
 * Keep clipped INSERTs as individual GPU instances and carry their block-local
 * clip polygons into the serialized scene. dxf-viewer normally flattens
 * one-use blocks, which would discard the identity needed for masking.
 */
export function installXclipScenePreparation(
  sceneConstructor: object,
): void {
  if (patchedConstructors.has(sceneConstructor)) {
    return;
  }
  const DxfScene =
    sceneConstructor as unknown as DxfSceneConstructor;

  const originalBuild = DxfScene.prototype.Build;
  DxfScene.prototype.Build = async function (
    this: DxfSceneInstance,
    dxf: ParsedDxf,
    fontFetchers: unknown,
  ): Promise<void> {
    this.izcadXclips = prepareTopLevelXclips(dxf);
    this.izcadNestedXclips = {};
    this.izcadNestedClipSequence = 0;
    await originalBuild.call(this, dxf, fontFetchers);
  };

  const originalProcessInsert = DxfScene.prototype._ProcessInsert;
  DxfScene.prototype._ProcessInsert = function (
    this: DxfSceneInstance,
    entity: DxfInsert,
    blockContext?: BlockContext | null,
  ): void {
    if (
      !blockContext &&
      entity.name?.startsWith(XCLIP_BLOCK_PREFIX)
    ) {
      const block = this.blocks.get(entity.name);
      if (block) {
        block.flatten = false;
      }
    }

    const inheritedClip = blockContext?.izcadNestedClip;
    const clipPoints = blockContext
      ? parseDxfXclip(entity)
      : null;
    if (
      blockContext &&
      entity.name &&
      (clipPoints || inheritedClip)
    ) {
      if (blockContext.name === entity.name) {
        return;
      }
      const nestedBlock = this.blocks.get(entity.name);
      if (!nestedBlock) {
        return;
      }

      const nestedContext =
        blockContext.NestedBlockContext(nestedBlock, entity);
      if (clipPoints) {
        const marker = `${
          ++this.izcadNestedClipSequence!
        }_${String(entity.handle ?? "INSERT")}`;
        nestedContext.izcadNestedClip = marker;
        this.izcadNestedXclips![marker] = {
          rootBlockName: blockContext.block.data.name,
          points: clipPoints.map(({ x, y }) => {
            const point = new Vector2(x, y).applyMatrix3(
              nestedContext.transform,
            );
            return { x: point.x, y: point.y };
          }),
        };
      } else {
        nestedContext.izcadNestedClip = inheritedClip;
      }

      for (const nestedEntity of nestedBlock.data.entities ?? []) {
        this._ProcessDxfEntity(nestedEntity, nestedContext);
      }
      return;
    }

    originalProcessInsert.call(this, entity, blockContext);
  };

  const originalGetEntityLayer = DxfScene.prototype._GetEntityLayer;
  DxfScene.prototype._GetEntityLayer = function (
    this: DxfSceneInstance,
    entity: DxfInsert,
    blockContext?: BlockContext | null,
  ): string | null {
    const layerName = originalGetEntityLayer.call(
      this,
      entity,
      blockContext,
    );
    const marker = blockContext?.izcadNestedClip;
    if (!marker) {
      return layerName;
    }

    const syntheticName =
      `${NESTED_XCLIP_LAYER_PREFIX}${marker}__` +
      (layerName ?? "0");
    if (!this.layers.has(syntheticName)) {
      const sourceLayer =
        this.layers.get(layerName ?? "0") ??
        this.layers.get("0") ??
        {};
      this.layers.set(syntheticName, {
        ...sourceLayer,
        name: syntheticName,
        displayName: syntheticName,
      });
    }
    return syntheticName;
  };

  const originalBuildScene = DxfScene.prototype._BuildScene;
  DxfScene.prototype._BuildScene = function (
    this: DxfSceneInstance,
  ): SerializedScene {
    const scene = originalBuildScene.call(this);
    const serialized: Record<string, SerializedXclip> = {};

    for (const [name, points] of Object.entries(
      this.izcadXclips ?? {},
    )) {
      const offset = this.blocks.get(name)?.offset;
      if (!offset) {
        continue;
      }
      serialized[name] = {
        points,
        blockOffset: { x: offset.x, y: offset.y },
      };
    }

    if (Object.keys(serialized).length > 0) {
      scene.izcadXclips = serialized;
    }

    const serializedNested: Record<string, SerializedXclip> = {};
    for (const [marker, clip] of Object.entries(
      this.izcadNestedXclips ?? {},
    )) {
      const offset = this.blocks.get(
        clip.rootBlockName,
      )?.offset;
      if (!offset) {
        continue;
      }
      serializedNested[marker] = {
        points: clip.points,
        blockOffset: { x: offset.x, y: offset.y },
      };
    }
    if (Object.keys(serializedNested).length > 0) {
      scene.izcadNestedXclips = serializedNested;
    }
    return scene;
  };

  patchedConstructors.add(sceneConstructor);
}
