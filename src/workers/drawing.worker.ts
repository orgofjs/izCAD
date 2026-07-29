import { DxfViewer } from "dxf-viewer";
import { DxfScene } from "dxf-viewer/src/DxfScene.js";
import { installSavedLayerVisibility } from "../viewer/savedLayerVisibility";
import { installXclipScenePreparation } from "../viewer/xclipScene";

installSavedLayerVisibility(DxfScene);
installXclipScenePreparation(DxfScene);
DxfViewer.SetupWorker();
