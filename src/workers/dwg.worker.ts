import {
  classifyEngineError,
  engineErrorName,
  inspectDwgInput,
  isLikelyMemoryError,
} from "../dwg/diagnostics";
import type {
  AppErrorCode,
  DwgDiagnostic,
} from "../types/drawing";

type DwgRequest = {
  id: number;
  input: ArrayBuffer;
  baseUrl: string;
};

type DwgSuccess = {
  id: number;
  status: "success";
  output: ArrayBuffer;
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
): Promise<ArrayBuffer> {
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

    const output = runtime.FS.readFile(outputPath);
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

    return (
      output.byteOffset === 0 &&
      output.byteLength === output.buffer.byteLength
        ? output.buffer
        : output.slice().buffer
    ) as ArrayBuffer;
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
    const output = await convertWithLibreDwg(input, baseUrl);
    const response: DwgSuccess = {
      id,
      status: "success",
      output,
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
