import { replaceExtension } from "../files/fileTypes";
import { inspectDwgInput } from "./diagnostics";
import {
  AppError,
  type AppErrorCode,
  type DwgDiagnostic,
} from "../types/drawing";
import {
  registerSavedDrawingView,
  type SavedDrawingView,
} from "../viewer/savedView";

type DwgWorkerResponse =
  | {
      id: number;
      status: "success";
      output: ArrayBuffer;
      savedView: SavedDrawingView | null;
    }
  | {
      id: number;
      status: "error";
      code: AppErrorCode;
      message: string;
      diagnostic: DwgDiagnostic;
    };

const CONVERSION_TIMEOUT_MS = 3 * 60 * 1000;
let conversionId = 0;

function abortError(): DOMException {
  return new DOMException("DWG conversion was cancelled.", "AbortError");
}

function runConversionWorker(
  input: ArrayBuffer,
  signal?: AbortSignal,
): Promise<{
  output: ArrayBuffer;
  savedView: SavedDrawingView | null;
}> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }

    const id = ++conversionId;
    const diagnostic = inspectDwgInput(input);
    const worker = new Worker(
      new URL("../workers/dwg.worker.ts", import.meta.url),
      {
        type: "module",
        name: "izcad-dwg-converter",
      },
    );

    const cleanup = () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", handleAbort);
      worker.terminate();
    };

    const handleAbort = () => {
      cleanup();
      reject(abortError());
    };

    const timeout = window.setTimeout(() => {
      cleanup();
      reject(
        new AppError(
          "DWG_CONVERSION_TIMEOUT",
          "DWG conversion timed out.",
          { details: { dwg: diagnostic } },
        ),
      );
    }, CONVERSION_TIMEOUT_MS);

    signal?.addEventListener("abort", handleAbort, { once: true });

    worker.onmessage = (event: MessageEvent<DwgWorkerResponse>) => {
      const response = event.data;
      if (response.id !== id) {
        return;
      }

      cleanup();
      if (response.status === "success") {
        resolve({
          output: response.output,
          savedView: response.savedView,
        });
      } else {
        reject(
          new AppError(
            response.code,
            response.message,
            { details: { dwg: response.diagnostic } },
          ),
        );
      }
    };

    worker.onerror = (event) => {
      cleanup();
      reject(
        new AppError(
          "DWG_RUNTIME_MISSING",
          event.message || "DWG conversion worker could not start.",
          { details: { dwg: diagnostic } },
        ),
      );
    };

    worker.postMessage(
      {
        id,
        input,
        baseUrl: document.baseURI,
      },
      [input],
    );
  });
}

export async function convertDwgToDxf(
  file: File,
  signal?: AbortSignal,
): Promise<File> {
  try {
    const input = await file.arrayBuffer();
    const { output, savedView } = await runConversionWorker(
      input,
      signal,
    );

    const renderFile = new File(
      [output],
      replaceExtension(file.name, "dxf"),
      {
        type: "application/dxf",
        lastModified: Date.now(),
      },
    );
    registerSavedDrawingView(renderFile, savedView);
    return renderFile;
  } catch (error) {
    if (
      error instanceof AppError ||
      (error instanceof DOMException && error.name === "AbortError")
    ) {
      throw error;
    }

    throw new AppError(
      "DWG_CONVERSION_FAILED",
      "DWG could not be converted to DXF.",
      { cause: error },
    );
  }
}
