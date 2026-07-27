import type { DrawingFile, DrawingFormat } from "../types/drawing";
import { AppError } from "../types/drawing";

const SUPPORTED_EXTENSIONS = new Set<DrawingFormat>(["dxf", "dwg"]);

export const DRAWING_FILE_ACCEPT =
  ".dxf,.dwg,application/dxf,application/acad,application/x-acad,application/autocad_dwg,image/vnd.dwg,application/octet-stream";

export function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot < 0 || lastDot === fileName.length - 1) {
    return "";
  }

  return fileName.slice(lastDot + 1).toLowerCase();
}

export function detectDrawingFormat(fileName: string): DrawingFormat | null {
  const extension = getFileExtension(fileName);
  return SUPPORTED_EXTENSIONS.has(extension as DrawingFormat)
    ? (extension as DrawingFormat)
    : null;
}

export function toDrawingFile(file: File): DrawingFile {
  const format = detectDrawingFormat(file.name);
  if (!format) {
    throw new AppError("UNSUPPORTED_FORMAT");
  }

  return {
    file,
    name: file.name,
    format,
    size: file.size,
  };
}

export function replaceExtension(fileName: string, extension: string): string {
  const lastDot = fileName.lastIndexOf(".");
  const baseName = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
  return `${baseName}.${extension.replace(/^\./, "")}`;
}
