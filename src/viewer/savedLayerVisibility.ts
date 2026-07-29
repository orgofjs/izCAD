type DxfEntity = object;

type DxfLayer = {
  visible?: boolean;
};

type DxfScenePrototype = {
  layers: Map<string, DxfLayer>;
  _FilterEntity(entity: DxfEntity): boolean;
  _GetEntityLayer(entity: DxfEntity): string;
};

type DxfSceneConstructor = {
  prototype: DxfScenePrototype;
};

const patchedConstructors = new WeakSet<object>();

/**
 * dxf-viewer 1.0.48 parses the DXF layer visibility flag (group code 62)
 * but only filters frozen layers while preparing the scene. Apply the saved
 * ON/OFF state inside the drawing worker so hidden geometry never reaches
 * the WebGL scene or affects the initial drawing bounds.
 */
export function installSavedLayerVisibility(
  DxfScene: DxfSceneConstructor,
): void {
  if (patchedConstructors.has(DxfScene)) {
    return;
  }

  const originalFilter = DxfScene.prototype._FilterEntity;
  DxfScene.prototype._FilterEntity = function (
    this: DxfScenePrototype,
    entity: DxfEntity,
  ): boolean {
    if (!originalFilter.call(this, entity)) {
      return false;
    }

    const layerName = this._GetEntityLayer(entity);
    if (layerName === "0") {
      // Keep dxf-viewer's layer 0 inheritance behavior for block contents.
      return true;
    }

    return this.layers.get(layerName)?.visible !== false;
  };

  patchedConstructors.add(DxfScene);
}
