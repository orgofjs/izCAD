import {
  Material,
  Object3D,
  RawShaderMaterial,
  Scene,
  Vector2,
} from "three";
import type { SerializedXclip } from "./xclipScene";

type SerializedScene = {
  izcadXclips?: Record<string, SerializedXclip>;
  izcadNestedXclips?: Record<string, SerializedXclip>;
};

type SerializedBatch = {
  key?: {
    blockName?: string | null;
  };
};

type DxfViewerInstance = {
  scene: Scene;
  blocks: Map<
    string,
    {
      batches: Array<{
        key: {
          layerName?: string | null;
        };
        chunks?: unknown[];
        vertices?: unknown;
      }>;
    }
  >;
  _LoadBatch(
    scene: SerializedScene,
    batch: SerializedBatch,
  ): void;
  Clear(): void;
};

type DxfViewerConstructor = {
  prototype: DxfViewerInstance;
};

type RenderObject = Object3D & {
  material?: Material | Material[];
};

const MAX_CLIP_POINTS = 32;
const MATERIAL_FLAG = "izcadXclipMaterial";
const MATERIAL_CLIP_COUNT = "izcadXclipCount";
const NESTED_XCLIP_LAYER_PREFIX = "__IZCAD_NESTED_XCLIP_";
const patchedConstructors = new WeakSet<object>();

function rectangleFromBounds(
  points: readonly { x: number; y: number }[],
): Array<{ x: number; y: number }> {
  const xs = points.map(({ x }) => x);
  const ys = points.map(({ y }) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}

function normalizePolygon(
  points: readonly { x: number; y: number }[],
): Array<{ x: number; y: number }> {
  if (points.length === 2 || points.length > MAX_CLIP_POINTS) {
    return rectangleFromBounds(points);
  }
  return [...points];
}

function addClipShader(
  source: RawShaderMaterial,
  clip: SerializedXclip,
): RawShaderMaterial {
  const material = source.clone();
  const points = normalizePolygon(clip.points);
  const clipCount =
    typeof source.userData[MATERIAL_CLIP_COUNT] === "number"
      ? source.userData[MATERIAL_CLIP_COUNT] + 1
      : 1;
  const suffix = `_${clipCount}`;
  const clipPosition = `izcadClipPosition${suffix}`;
  const clipOffset = `izcadClipOffset${suffix}`;
  const clipPointCount = `izcadClipPointCount${suffix}`;
  const clipPolygon = `izcadClipPolygon${suffix}`;
  const vertexDeclaration = `
out vec2 ${clipPosition};
uniform vec2 ${clipOffset};
`;
  const fragmentDeclaration = `
in vec2 ${clipPosition};
uniform int ${clipPointCount};
uniform vec2 ${clipPolygon}[${MAX_CLIP_POINTS}];
`;
  const fragmentClip = `
    bool izcadInsideClip = false;
    for (int izcadIndex = 0; izcadIndex < ${MAX_CLIP_POINTS}; izcadIndex++) {
        if (izcadIndex >= ${clipPointCount}) {
            break;
        }
        int izcadPrevious = izcadIndex == 0
            ? ${clipPointCount} - 1
            : izcadIndex - 1;
        vec2 izcadA = ${clipPolygon}[izcadIndex];
        vec2 izcadB = ${clipPolygon}[izcadPrevious];
        bool izcadCrosses =
            (izcadA.y > ${clipPosition}.y) !=
            (izcadB.y > ${clipPosition}.y);
        float izcadDy = izcadB.y - izcadA.y;
        if (izcadCrosses && abs(izcadDy) > 0.0000001) {
            float izcadCrossX =
                (izcadB.x - izcadA.x) *
                (${clipPosition}.y - izcadA.y) /
                izcadDy +
                izcadA.x;
            if (${clipPosition}.x < izcadCrossX) {
                izcadInsideClip = !izcadInsideClip;
            }
        }
    }
    if (!izcadInsideClip) {
        discard;
    }
`;

  material.vertexShader = material.vertexShader
    .replace("void main() {", `${vertexDeclaration}\nvoid main() {`)
    .replace(
      "vec4 pos = vec4(position, 0.0, 1.0);",
      `vec4 pos = vec4(position, 0.0, 1.0);
            ${clipPosition} = position + ${clipOffset};`,
    );
  material.fragmentShader = material.fragmentShader
    .replace(
      "void main() {",
      `${fragmentDeclaration}\nvoid main() {\n${fragmentClip}`,
    );
  material.uniforms = {
    ...material.uniforms,
    [clipOffset]: {
      value: new Vector2(
        clip.blockOffset.x,
        clip.blockOffset.y,
      ),
    },
    [clipPointCount]: { value: points.length },
    [clipPolygon]: {
      value: Array.from(
        { length: MAX_CLIP_POINTS },
        (_, index) => {
          const point = points[index] ?? points[0];
          return new Vector2(point.x, point.y);
        },
      ),
    },
  };
  material.userData[MATERIAL_FLAG] = true;
  material.userData[MATERIAL_CLIP_COUNT] = clipCount;
  material.needsUpdate = true;
  return material;
}

function nestedClipMarker(
  layerName: string | null | undefined,
): string | null {
  if (!layerName?.startsWith(NESTED_XCLIP_LAYER_PREFIX)) {
    return null;
  }
  const markerEnd = layerName.indexOf(
    "__",
    NESTED_XCLIP_LAYER_PREFIX.length,
  );
  return markerEnd < 0
    ? null
    : layerName.slice(
        NESTED_XCLIP_LAYER_PREFIX.length,
        markerEnd,
      );
}

function objectCountForBlockBatch(batch: {
  chunks?: unknown[];
  vertices?: unknown;
}): number {
  if (batch.chunks) {
    return batch.chunks.length;
  }
  return batch.vertices ? 1 : 0;
}

function applyClipMaterial(
  object: RenderObject,
  clip: SerializedXclip,
): void {
  if (!object.material) {
    return;
  }

  const patch = (material: Material): Material =>
    material instanceof RawShaderMaterial
      ? addClipShader(material, clip)
      : material;
  object.material = Array.isArray(object.material)
    ? object.material.map(patch)
    : patch(object.material);
}

function disposeClipMaterial(object: RenderObject): void {
  const materials = Array.isArray(object.material)
    ? object.material
    : object.material
      ? [object.material]
      : [];
  for (const material of materials) {
    if (material.userData[MATERIAL_FLAG]) {
      material.dispose();
    }
  }
}

/**
 * Apply each serialized XCLIP polygon only to the corresponding block
 * instance. The custom shader clips lines, points and filled geometry without
 * changing the source drawing or its layer state.
 */
export function installXclipRendering(
  viewerConstructor: object,
): void {
  if (patchedConstructors.has(viewerConstructor)) {
    return;
  }
  const DxfViewer =
    viewerConstructor as unknown as DxfViewerConstructor;

  const originalLoadBatch = DxfViewer.prototype._LoadBatch;
  DxfViewer.prototype._LoadBatch = function (
    this: DxfViewerInstance,
    scene: SerializedScene,
    batch: SerializedBatch,
  ): void {
    const firstNewChild = this.scene.children.length;
    originalLoadBatch.call(this, scene, batch);

    const blockName = batch.key?.blockName;
    const clip = blockName
      ? scene.izcadXclips?.[blockName]
      : undefined;
    const newChildren = this.scene.children.slice(firstNewChild);
    if (clip) {
      for (const child of newChildren) {
        applyClipMaterial(child as RenderObject, clip);
      }
    }

    if (!blockName || !scene.izcadNestedXclips) {
      return;
    }
    const block = this.blocks.get(blockName);
    if (!block) {
      return;
    }

    let childIndex = 0;
    for (const blockBatch of block.batches) {
      const count = objectCountForBlockBatch(blockBatch);
      const marker = nestedClipMarker(
        blockBatch.key.layerName,
      );
      const nestedClip = marker
        ? scene.izcadNestedXclips[marker]
        : undefined;
      if (nestedClip) {
        for (
          let offset = 0;
          offset < count &&
          childIndex + offset < newChildren.length;
          offset += 1
        ) {
          applyClipMaterial(
            newChildren[childIndex + offset] as RenderObject,
            nestedClip,
          );
        }
      }
      childIndex += count;
    }
  };

  const originalClear = DxfViewer.prototype.Clear;
  DxfViewer.prototype.Clear = function (
    this: DxfViewerInstance,
  ): void {
    this.scene.traverse((object) => {
      disposeClipMaterial(object as RenderObject);
    });
    originalClear.call(this);
  };

  patchedConstructors.add(viewerConstructor);
}
