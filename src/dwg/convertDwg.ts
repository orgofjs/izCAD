import { replaceExtension } from "../files/fileTypes";
import { AppError } from "../types/drawing";

type DwgWorkerResponse =
  | {
      id: number;
      status: "success";
      output: ArrayBuffer;
    }
  | {
      id: number;
      status: "error";
      message: string;
    };

const CONVERSION_TIMEOUT_MS = 3 * 60 * 1000;
let conversionId = 0;

function abortError(): DOMException {
  return new DOMException("DWG conversion was cancelled.", "AbortError");
}

function runConversionWorker(
  input: ArrayBuffer,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }

    const id = ++conversionId;
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
          "DWG_CONVERSION_FAILED",
          "DWG conversion timed out.",
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
        resolve(response.output);
      } else {
        reject(
          new AppError(
            "DWG_CONVERSION_FAILED",
            response.message,
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
    const output = await runConversionWorker(input, signal);

    return new File(
      [output],
      replaceExtension(file.name, "dxf"),
      {
        type: "application/dxf",
        lastModified: Date.now(),
      },
    );
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
