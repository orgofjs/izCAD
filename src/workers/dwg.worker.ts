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
  message: string;
};

type EmscriptenDisposable = {
  delete(): void;
};

type LibDxfrwDatabase = EmscriptenDisposable;

type LibDxfrwFileHandler = EmscriptenDisposable & {
  database: LibDxfrwDatabase | null;
  fileExport(
    version: unknown,
    binary: boolean,
    database: LibDxfrwDatabase,
    preserveHandles: boolean,
  ): string;
};

type LibDxfrwReader = EmscriptenDisposable & {
  read(fileHandler: LibDxfrwFileHandler, ext: boolean): boolean;
};

type LibDxfrwModule = {
  DRW_Database: new () => LibDxfrwDatabase;
  DRW_FileHandler: new () => LibDxfrwFileHandler;
  DRW_DwgR: new (input: ArrayBuffer) => LibDxfrwReader;
  DRW_Version: { AC1021: unknown };
};

type LibDxfrwFactory = (options: {
  locateFile(path: string): string;
  printErr(message: string): void;
}) => Promise<LibDxfrwModule>;

const workerScope = self as DedicatedWorkerGlobalScope;
const textEncoder = new TextEncoder();

function assetUrl(baseUrl: string, path: string): string {
  return new URL(`wasm/${path}`, baseUrl).href;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function convertWithLibDxfrw(
  input: ArrayBuffer,
  baseUrl: string,
): Promise<ArrayBuffer> {
  const moduleUrl = assetUrl(baseUrl, "libdxfrw-web.js");
  const imported = (await import(
    /* @vite-ignore */ moduleUrl
  )) as { default?: LibDxfrwFactory } | LibDxfrwFactory;
  const factory =
    typeof imported === "function" ? imported : imported.default;

  if (!factory) {
    throw new Error("libdxfrw module factory was not exported.");
  }

  const runtime = await factory({
    locateFile: (path) => assetUrl(baseUrl, path),
    printErr: () => {
      // Native parser diagnostics may contain file metadata; keep them local.
    },
  });

  const database = new runtime.DRW_Database();
  const fileHandler = new runtime.DRW_FileHandler();
  const reader = new runtime.DRW_DwgR(input);
  fileHandler.database = database;

  try {
    // libdxfrw may return false after recovering unsupported objects while
    // still producing a valid database, so the generated DXF is validated.
    reader.read(fileHandler, false);
    const dxf = fileHandler.fileExport(
      runtime.DRW_Version.AC1021,
      false,
      database,
      false,
    );

    if (!dxf.includes("SECTION") || !dxf.includes("EOF")) {
      throw new Error("libdxfrw did not create a valid DXF document.");
    }

    return textEncoder.encode(dxf).buffer;
  } finally {
    reader.delete();
    fileHandler.delete();
    database.delete();
  }
}

workerScope.onmessage = async (event: MessageEvent<DwgRequest>) => {
  const { id, input, baseUrl } = event.data;

  try {
    const output = await convertWithLibDxfrw(input, baseUrl);

    const response: DwgSuccess = {
      id,
      status: "success",
      output,
    };
    workerScope.postMessage(response, [output]);
  } catch (error) {
    const response: DwgFailure = {
      id,
      status: "error",
      message: errorMessage(error),
    };
    workerScope.postMessage(response);
  }
};

export {};
