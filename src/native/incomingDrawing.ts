import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from "@capacitor/core";

export type IncomingDrawing = {
  id: string;
  uri: string;
  name: string;
  mimeType: string;
  size: number;
};

type PendingDrawingResult = {
  drawing: IncomingDrawing | null;
};

type AcknowledgeDrawingResult = {
  acknowledged: boolean;
};

interface IncomingDrawingPlugin {
  getPendingDrawing(): Promise<PendingDrawingResult>;
  acknowledgeDrawing(options: {
    id: string;
  }): Promise<AcknowledgeDrawingResult>;
  addListener(
    eventName: "drawingReceived",
    listener: (drawing: IncomingDrawing) => void,
  ): Promise<PluginListenerHandle>;
}

export const incomingDrawingPlugin =
  registerPlugin<IncomingDrawingPlugin>("IncomingDrawing");

export async function readIncomingDrawingFile(
  drawing: IncomingDrawing,
): Promise<File> {
  const localUrl = Capacitor.convertFileSrc(drawing.uri);
  const response = await fetch(localUrl);
  if (!response.ok) {
    throw new Error(`Incoming drawing could not be read (${response.status}).`);
  }

  const blob = await response.blob();
  return new File([blob], drawing.name, {
    type: drawing.mimeType || blob.type || "application/octet-stream",
    lastModified: Date.now(),
  });
}
