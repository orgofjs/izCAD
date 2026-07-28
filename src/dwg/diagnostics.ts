import type {
  AppErrorCode,
  DwgDiagnostic,
} from "../types/drawing";

const DWG_VERSIONS: Record<string, string> = {
  AC1009: "AutoCAD R11/R12",
  AC1012: "AutoCAD R13",
  AC1014: "AutoCAD R14",
  AC1015: "AutoCAD 2000",
  AC1018: "AutoCAD 2004",
  AC1021: "AutoCAD 2007",
  AC1024: "AutoCAD 2010",
  AC1027: "AutoCAD 2013",
  AC1032: "AutoCAD 2018 format",
};

const LIBREDWG_ERROR_FLAGS: ReadonlyArray<
  readonly [number, string]
> = [
  [1, "WRONGCRC"],
  [2, "NOTYETSUPPORTED"],
  [4, "UNHANDLEDCLASS"],
  [8, "INVALIDTYPE"],
  [16, "INVALIDHANDLE"],
  [32, "INVALIDEED"],
  [64, "VALUEOUTOFBOUNDS"],
  [128, "CLASSESNOTFOUND"],
  [256, "SECTIONNOTFOUND"],
  [512, "PAGENOTFOUND"],
  [1024, "INTERNALERROR"],
  [2048, "INVALIDDWG"],
  [4096, "IOERROR"],
  [8192, "OUTOFMEM"],
];

function readHeader(input: ArrayBuffer): string {
  const bytes = new Uint8Array(input, 0, Math.min(6, input.byteLength));
  return String.fromCharCode(...bytes);
}

export function inspectDwgInput(input: ArrayBuffer): DwgDiagnostic {
  const header = readHeader(input);
  const label = DWG_VERSIONS[header];
  const printableHeader = /^[\x20-\x7e]{6}$/.test(header)
    ? header
    : "UNKNOWN";

  return {
    engine: "libredwg",
    version: label
      ? `${printableHeader} (${label})`
      : printableHeader,
    fileSizeBytes: input.byteLength,
  };
}

export function engineErrorName(value: number): string {
  if (value === 0) {
    return "OK";
  }

  const names = LIBREDWG_ERROR_FLAGS.filter(
    ([flag]) => (value & flag) !== 0,
  ).map(([, name]) => name);
  return names.length > 0
    ? names.join("|")
    : `LIBREDWG_ERROR_${value}`;
}

export function classifyEngineError(value: number): AppErrorCode {
  if ((value & 8192) !== 0) {
    return "DWG_MEMORY_LIMIT";
  }

  if ((value & (1 | 8 | 16 | 32 | 64 | 2048)) !== 0) {
    return "DWG_CORRUPT_OR_ENCRYPTED";
  }

  return "DWG_PARSE_FAILED";
}

export function isLikelyMemoryError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /out of memory|memory access out of bounds|cannot enlarge memory|allocation failed|oom/i.test(
    message,
  );
}
