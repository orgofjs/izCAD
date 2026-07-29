import {
  classifyEngineError,
  engineErrorName,
  inspectDwgInput,
  isLikelyMemoryError,
} from "../dwg/diagnostics";
import {
  restoreDxfLayerStates,
  type SavedDwgLayerState,
  type SavedDwgLayerStates,
} from "../dwg/layerVisibility";
import { annotateDxfXclips } from "../dwg/xclipMetadata";
import type {
  AppErrorCode,
  DwgDiagnostic,
} from "../types/drawing";
import {
  normalizeSavedDrawingView,
  type DrawingPoint,
  type SavedDrawingView,
} from "../viewer/savedView";

type DwgRequest = {
  id: number;
  input: ArrayBuffer;
  baseUrl: string;
};

type DwgSuccess = {
  id: number;
  status: "success";
  output: ArrayBuffer;
  savedView: SavedDrawingView | null;
};

type DwgFailure = {
  id: number;
  status: "error";
  code: AppErrorCode;
  message: string;
  diagnostic: DwgDiagnostic;
};

type LibreDwgFileSystem = {
  writeFile(path: string, data: Uint8Array): void;
  readFile(path: string): Uint8Array;
  unlink(path: string): void;
};

type LibreDwgModule = {
  FS: LibreDwgFileSystem;
  dwg_abandon(data: number): void;
  dwg_dynapi_entity_value(
    object: number,
    field: string,
  ): { data?: unknown } | null;
  dwg_free(data: number): void;
  dwg_get_num_objects(data: number): number;
  dwg_get_object(data: number, index: number): number;
  dwg_obj_layer_get_name(layer: number): string;
  dwg_obj_table_get_name(table: number): string;
  dwg_object_get_fixedtype(object: number): number;
  dwg_object_to_object_tio(object: number): number;
  dwg_read_file(inputPath: string): {
    data: number;
    error: number;
  };
  dwg_write_dxf(inputPath: string, outputPath: string): number;
};

type LibreDwgFactory = (options: {
  locateFile(path: string): string;
  print(message: string): void;
  printErr(message: string): void;
}) => Promise<LibreDwgModule>;

const workerScope = self as DedicatedWorkerGlobalScope;

class DwgWorkerError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly diagnostic: DwgDiagnostic,
  ) {
    super(message);
    this.name = "DwgWorkerError";
  }
}

function assetUrl(baseUrl: string, path: string): string {
  return new URL(`wasm/${path}`, baseUrl).href;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function containsAscii(bytes: Uint8Array, value: string): boolean {
  const needle = new TextEncoder().encode(value);
  outer: for (let offset = 0; offset <= bytes.length - needle.length; offset += 1) {
    for (let index = 0; index < needle.length; index += 1) {
      if (bytes[offset + index] !== needle[index]) {
        continue outer;
      }
    }
    return true;
  }
  return false;
}

function unlinkIfPresent(
  fileSystem: LibreDwgFileSystem,
  path: string,
): void {
  try {
    fileSystem.unlink(path);
  } catch {
    // The conversion may fail before a temporary file is created.
  }
}

function dynapiBoolean(
  runtime: LibreDwgModule,
  object: number,
  field: string,
): boolean {
  return Boolean(
    runtime.dwg_dynapi_entity_value(object, field)?.data,
  );
}

function dynapiData(
  runtime: LibreDwgModule,
  object: number,
  field: string,
): unknown {
  return runtime.dwg_dynapi_entity_value(object, field)?.data;
}

function dynapiNumber(
  runtime: LibreDwgModule,
  object: number,
  field: string,
): number | undefined {
  const value = dynapiData(runtime, object, field);
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function dynapiPoint(
  runtime: LibreDwgModule,
  object: number,
  field: string,
): DrawingPoint | null {
  const value = dynapiData(runtime, object, field);
  if (!value || typeof value !== "object") {
    return null;
  }

  const point = value as { x?: unknown; y?: unknown };
  return typeof point.x === "number" &&
    Number.isFinite(point.x) &&
    typeof point.y === "number" &&
    Number.isFinite(point.y)
    ? { x: point.x, y: point.y }
    : null;
}

type SavedDwgMetadata = {
  layerStates: SavedDwgLayerStates | null;
  savedView: SavedDrawingView | null;
};

function readSavedDwgMetadata(
  runtime: LibreDwgModule,
  inputPath: string,
): SavedDwgMetadata {
  const layerType = 51;
  const viewportType = 65;
  let data = 0;

  try {
    const result = runtime.dwg_read_file(inputPath);
    data = result.data;
    const fatalReadErrorMask = 1024 | 2048 | 4096 | 8192;
    if (!data || (result.error & fatalReadErrorMask) !== 0) {
      return {
        layerStates: null,
        savedView: null,
      };
    }

    const states = new Map<string, SavedDwgLayerState>();
    let savedView: SavedDrawingView | null = null;
    let activeViewportView: SavedDrawingView | null = null;
    const objectCount = runtime.dwg_get_num_objects(data);
    for (let index = 0; index < objectCount; index += 1) {
      const object = runtime.dwg_get_object(data, index);
      const fixedType = runtime.dwg_object_get_fixedtype(object);
      if (fixedType === viewportType) {
        const viewport = runtime.dwg_object_to_object_tio(object);
        const center = dynapiPoint(runtime, viewport, "VIEWCTR");
        const viewHeight = dynapiNumber(
          runtime,
          viewport,
          "VIEWSIZE",
        );
        if (!center || viewHeight === undefined) {
          continue;
        }

        const candidate = normalizeSavedDrawingView({
          center,
          viewHeight,
          aspectRatio: dynapiNumber(
            runtime,
            viewport,
            "aspect_ratio",
          ),
          twistAngle: dynapiNumber(
            runtime,
            viewport,
            "view_twist",
          ),
        });
        if (!candidate) {
          continue;
        }

        savedView ??= candidate;
        const name = runtime.dwg_obj_table_get_name(viewport);
        const lowerLeft = dynapiPoint(
          runtime,
          viewport,
          "lower_left",
        );
        const upperRight = dynapiPoint(
          runtime,
          viewport,
          "upper_right",
        );
        const coversModelWindow =
          lowerLeft?.x === 0 &&
          lowerLeft.y === 0 &&
          upperRight?.x === 1 &&
          upperRight.y === 1;
        if (
          name.trim().toLocaleLowerCase() === "*active" ||
          coversModelWindow
        ) {
          activeViewportView = candidate;
        }
        continue;
      }

      if (fixedType !== layerType) {
        continue;
      }

      const layer = runtime.dwg_object_to_object_tio(object);
      const name = runtime.dwg_obj_layer_get_name(layer);
      if (!name) {
        continue;
      }

      states.set(name, {
        off: dynapiBoolean(runtime, layer, "off"),
        frozen: dynapiBoolean(runtime, layer, "frozen"),
        frozenInNewViewport: dynapiBoolean(
          runtime,
          layer,
          "frozen_in_new",
        ),
      });
    }

    return {
      layerStates: states.size > 0 ? states : null,
      savedView: activeViewportView ?? savedView,
    };
  } catch {
    return {
      layerStates: null,
      savedView: null,
    };
  } finally {
    if (data) {
      try {
        runtime.dwg_free(data);
      } catch {
        try {
          runtime.dwg_abandon(data);
        } catch {
          // The runtime will be discarded with the conversion worker.
        }
      }
    }
  }
}

async function loadRuntime(
  baseUrl: string,
  diagnostic: DwgDiagnostic,
  onNativeError: (message: string) => void,
): Promise<LibreDwgModule> {
  const moduleUrl = assetUrl(baseUrl, "libredwg-web.js");
  let factory: LibreDwgFactory | undefined;

  try {
    const imported = (await import(
      /* @vite-ignore */ moduleUrl
    )) as { default?: LibreDwgFactory } | LibreDwgFactory;
    factory =
      typeof imported === "function" ? imported : imported.default;
  } catch (error) {
    throw new DwgWorkerError(
      isLikelyMemoryError(error)
        ? "DWG_MEMORY_LIMIT"
        : "DWG_RUNTIME_MISSING",
      errorMessage(error),
      diagnostic,
    );
  }

  if (!factory) {
    throw new DwgWorkerError(
      "DWG_RUNTIME_MISSING",
      "LibreDWG module factory was not exported.",
      diagnostic,
    );
  }

  try {
    return await factory({
      locateFile: (path) => assetUrl(baseUrl, path),
      print: () => {
        // LibreDWG CLI output is not needed in the application.
      },
      printErr: onNativeError,
    });
  } catch (error) {
    throw new DwgWorkerError(
      isLikelyMemoryError(error)
        ? "DWG_MEMORY_LIMIT"
        : "DWG_RUNTIME_MISSING",
      errorMessage(error),
      diagnostic,
    );
  }
}

async function convertWithLibreDwg(
  input: ArrayBuffer,
  baseUrl: string,
): Promise<{
  output: ArrayBuffer;
  savedView: SavedDrawingView | null;
}> {
  const diagnostic = inspectDwgInput(input);
  let nativeError = "";
  const runtime = await loadRuntime(
    baseUrl,
    diagnostic,
    (message) => {
      // Native output can contain drawing metadata. Keep it inside the worker
      // and use it only to recognize memory failures.
      nativeError = String(message).slice(0, 512);
    },
  );
  const inputPath = "/tmp/izcad-input.dwg";
  const outputPath = "/tmp/izcad-output.dxf";

  try {
    runtime.FS.writeFile(inputPath, new Uint8Array(input));
    const savedMetadata = readSavedDwgMetadata(runtime, inputPath);
    const errorValue = runtime.dwg_write_dxf(inputPath, outputPath);
    const diagnosticWithEngineCode: DwgDiagnostic = {
      ...diagnostic,
      engineCode: engineErrorName(errorValue),
    };

    if (errorValue !== 0) {
      throw new DwgWorkerError(
        classifyEngineError(errorValue),
        `LibreDWG conversion failed with ${engineErrorName(errorValue)}.`,
        diagnosticWithEngineCode,
      );
    }

    const output = annotateDxfXclips(
      restoreDxfLayerStates(
        runtime.FS.readFile(outputPath),
        savedMetadata.layerStates,
      ),
    );
    const outputPrefix = output.subarray(
      0,
      Math.min(output.byteLength, 4096),
    );
    const outputSuffix = output.subarray(
      Math.max(0, output.byteLength - 4096),
    );
    if (
      output.byteLength === 0 ||
      !containsAscii(outputPrefix, "SECTION") ||
      !containsAscii(outputSuffix, "EOF")
    ) {
      throw new DwgWorkerError(
        "DWG_EXPORT_FAILED",
        "LibreDWG did not create a valid DXF document.",
        diagnosticWithEngineCode,
      );
    }

    const outputBuffer = (
      output.byteOffset === 0 &&
      output.byteLength === output.buffer.byteLength
        ? output.buffer
        : output.slice().buffer
    ) as ArrayBuffer;
    return {
      output: outputBuffer,
      savedView: savedMetadata.savedView,
    };
  } catch (error) {
    if (error instanceof DwgWorkerError) {
      throw error;
    }

    throw new DwgWorkerError(
      isLikelyMemoryError(error) ||
      isLikelyMemoryError(nativeError)
        ? "DWG_MEMORY_LIMIT"
        : "DWG_CONVERSION_FAILED",
      errorMessage(error),
      diagnostic,
    );
  } finally {
    unlinkIfPresent(runtime.FS, inputPath);
    unlinkIfPresent(runtime.FS, outputPath);
  }
}

workerScope.onmessage = async (event: MessageEvent<DwgRequest>) => {
  const { id, input, baseUrl } = event.data;

  try {
    const { output, savedView } = await convertWithLibreDwg(
      input,
      baseUrl,
    );
    const response: DwgSuccess = {
      id,
      status: "success",
      output,
      savedView,
    };
    workerScope.postMessage(response, [output]);
  } catch (error) {
    const failure =
      error instanceof DwgWorkerError
        ? error
        : new DwgWorkerError(
            isLikelyMemoryError(error)
              ? "DWG_MEMORY_LIMIT"
              : "DWG_CONVERSION_FAILED",
            errorMessage(error),
            inspectDwgInput(input),
          );
    const response: DwgFailure = {
      id,
      status: "error",
      code: failure.code,
      message: failure.message,
      diagnostic: failure.diagnostic,
    };
    workerScope.postMessage(response);
  }
};

export {};
