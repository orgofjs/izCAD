export type DrawingFormat = "dxf" | "dwg";

export type DrawingFile = {
  file: File;
  name: string;
  format: DrawingFormat;
  size: number;
};

export type LoadingPhase =
  | "reading"
  | "converting"
  | "fetch"
  | "parse"
  | "prepare"
  | "font";

export type ViewerCommand = "zoom-in" | "zoom-out" | "fit" | "reset";

export type ViewerHandle = {
  execute(command: ViewerCommand): void;
};

export type AppErrorCode =
  | "UNSUPPORTED_FORMAT"
  | "FILE_READ_FAILED"
  | "DXF_OPEN_FAILED"
  | "DWG_CONVERSION_FAILED"
  | "DWG_RUNTIME_MISSING"
  | "RENDER_FAILED";

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message?: string,
    options?: ErrorOptions,
  ) {
    super(message ?? code, options);
    this.name = "AppError";
  }
}

