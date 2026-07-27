import { DxfViewer } from "dxf-viewer";
import { Color } from "three";
import type { LoadingPhase, ViewerCommand } from "../types/drawing";

const DRAWING_FONT_URL = new URL(
  "fonts/IzCadSans-Regular.ttf",
  document.baseURI,
).href;

type ProgressCallback = (
  phase: LoadingPhase,
  processed: number,
  total: number,
) => void;

export class DrawingViewer {
  private readonly viewer: DxfViewer;
  private objectUrl: string | null = null;

  constructor(container: HTMLElement) {
    this.viewer = new DxfViewer(container, {
      autoResize: true,
      clearColor: new Color("#0b1118"),
      clearAlpha: 1,
      antialias: true,
      colorCorrection: true,
      blackWhiteInversion: true,
      pointSize: 3,
      retainParsedDxf: false,
      preserveDrawingBuffer: false,
    });
  }

  async load(file: File, onProgress: ProgressCallback): Promise<void> {
    this.releaseObjectUrl();
    this.objectUrl = URL.createObjectURL(file);

    await this.viewer.Load({
      url: this.objectUrl,
      fonts: [DRAWING_FONT_URL],
      progressCbk: (phase, processed, total) => {
        onProgress(phase, processed, total);
      },
      workerFactory: () =>
        new Worker(new URL("../workers/drawing.worker.ts", import.meta.url), {
          type: "module",
          name: "izcad-dxf-worker",
      }),
    });
  }

  execute(command: ViewerCommand): void {
    switch (command) {
      case "zoom-in":
        this.zoom(1.25);
        break;
      case "zoom-out":
        this.zoom(0.8);
        break;
      case "fit":
      case "reset":
        this.fit();
        break;
    }
  }

  destroy(): void {
    this.releaseObjectUrl();
    const canvas = this.viewer.GetCanvas();
    this.viewer.Destroy();
    canvas.remove();
  }

  private zoom(factor: number): void {
    const camera = this.viewer.GetCamera();
    camera.zoom = Math.min(1000, Math.max(0.01, camera.zoom * factor));
    camera.updateProjectionMatrix();
    this.viewer.Render();
  }

  private fit(): void {
    const bounds = this.viewer.GetBounds();
    if (!bounds) {
      return;
    }

    const origin = this.viewer.GetOrigin();
    this.viewer.FitView(
      bounds.minX - origin.x,
      bounds.maxX - origin.x,
      bounds.minY - origin.y,
      bounds.maxY - origin.y,
      0.12,
    );
    this.viewer.Render();
  }

  private releaseObjectUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}
