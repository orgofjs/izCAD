import { detectDrawingFormat } from "../files/fileTypes";
import type { DrawingFormat } from "../types/drawing";

const DATABASE_NAME = "izcad-drawing-library";
const DATABASE_VERSION = 1;
const ENTRY_STORE = "entries";
const CONTENT_STORE = "contents";

export const ROOT_FOLDER_ID = "root";

type LibraryEntryBase = {
  id: string;
  parentId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
};

export type LibraryFolderEntry = LibraryEntryBase & {
  kind: "folder";
};

export type LibraryDrawingEntry = LibraryEntryBase & {
  kind: "drawing";
  format: DrawingFormat;
  mimeType: string;
  size: number;
  lastModified: number;
  lastOpenedAt: number;
};

export type LibraryEntry = LibraryFolderEntry | LibraryDrawingEntry;

type LibraryContent = {
  id: string;
  blob: Blob;
};

export type LibraryErrorCode =
  | "INVALID_NAME"
  | "NAME_EXISTS"
  | "NOT_FOUND"
  | "INVALID_DESTINATION"
  | "STORAGE_FULL"
  | "STORAGE_UNAVAILABLE";

export class LibraryError extends Error {
  constructor(public readonly code: LibraryErrorCode, options?: ErrorOptions) {
    super(code, options);
    this.name = "LibraryError";
  }
}

let databasePromise: Promise<IDBDatabase> | null = null;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed."));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  if (!("indexedDB" in globalThis)) {
    return Promise.reject(new LibraryError("STORAGE_UNAVAILABLE"));
  }

  if (!databasePromise) {
    databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;
        const entryStore = database.createObjectStore(ENTRY_STORE, {
          keyPath: "id",
        });
        entryStore.createIndex("parentId", "parentId", { unique: false });
        database.createObjectStore(CONTENT_STORE, { keyPath: "id" });
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => database.close();
        resolve(database);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        reject(new LibraryError("STORAGE_UNAVAILABLE"));
    }).catch((error: unknown): never => {
      databasePromise = null;
      throw toLibraryError(error);
    });
  }

  return databasePromise!;
}

function toLibraryError(error: unknown): LibraryError {
  if (error instanceof LibraryError) {
    return error;
  }

  if (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.name === "UnknownError")
  ) {
    return new LibraryError("STORAGE_FULL", { cause: error });
  }

  return new LibraryError("STORAGE_UNAVAILABLE", { cause: error });
}

function createId(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function normalizeEntryName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function isValidEntryName(name: string): boolean {
  const normalized = normalizeEntryName(name);
  return (
    normalized.length > 0 &&
    normalized.length <= 220 &&
    normalized !== "." &&
    normalized !== ".." &&
    !/[\\/\u0000-\u001f]/.test(normalized)
  );
}

function hasName(
  entries: readonly LibraryEntry[],
  parentId: string,
  name: string,
  ignoredId?: string,
): boolean {
  const normalizedName = name.toLocaleLowerCase();
  return entries.some(
    (entry) =>
      entry.parentId === parentId &&
      entry.id !== ignoredId &&
      entry.name.toLocaleLowerCase() === normalizedName,
  );
}

export function createUniqueEntryName(
  desiredName: string,
  usedNames: readonly string[],
): string {
  const used = new Set(usedNames.map((name) => name.toLocaleLowerCase()));
  if (!used.has(desiredName.toLocaleLowerCase())) {
    return desiredName;
  }

  const lastDot = desiredName.lastIndexOf(".");
  const hasExtension = lastDot > 0 && lastDot < desiredName.length - 1;
  const stem = hasExtension ? desiredName.slice(0, lastDot) : desiredName;
  const extension = hasExtension ? desiredName.slice(lastDot) : "";

  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const candidate = `${stem} (${suffix})${extension}`;
    if (!used.has(candidate.toLocaleLowerCase())) {
      return candidate;
    }
  }

  return `${stem} (${Date.now()})${extension}`;
}

async function readAllEntries(): Promise<LibraryEntry[]> {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(ENTRY_STORE, "readonly");
    const complete = transactionComplete(transaction);
    const entries = await requestResult(
      transaction.objectStore(ENTRY_STORE).getAll(),
    );
    await complete;
    return entries as LibraryEntry[];
  } catch (error) {
    throw toLibraryError(error);
  }
}

function ensureFolderExists(
  entries: readonly LibraryEntry[],
  folderId: string,
): void {
  if (folderId === ROOT_FOLDER_ID) {
    return;
  }

  const folder = entries.find((entry) => entry.id === folderId);
  if (!folder || folder.kind !== "folder") {
    throw new LibraryError("INVALID_DESTINATION");
  }
}

export async function requestPersistentLibraryStorage(): Promise<void> {
  try {
    if (navigator.storage?.persist) {
      await navigator.storage.persist();
    }
  } catch {
    // Persistence is a best-effort optimization. App-private data still works.
  }
}

export async function listLibraryChildren(
  parentId: string,
): Promise<LibraryEntry[]> {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(ENTRY_STORE, "readonly");
    const complete = transactionComplete(transaction);
    const index = transaction.objectStore(ENTRY_STORE).index("parentId");
    const entries = await requestResult(index.getAll(parentId));
    await complete;

    return (entries as LibraryEntry[]).sort((left, right) => {
      if (left.kind !== right.kind) {
        return left.kind === "folder" ? -1 : 1;
      }
      return left.name.localeCompare(right.name, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
  } catch (error) {
    throw toLibraryError(error);
  }
}

export async function listRecentDrawings(
  limit = 5,
): Promise<LibraryDrawingEntry[]> {
  const entries = await readAllEntries();
  return entries
    .filter((entry): entry is LibraryDrawingEntry => entry.kind === "drawing")
    .sort((left, right) => right.lastOpenedAt - left.lastOpenedAt)
    .slice(0, limit);
}

export async function listLibraryFolders(): Promise<LibraryFolderEntry[]> {
  const entries = await readAllEntries();
  return entries
    .filter((entry): entry is LibraryFolderEntry => entry.kind === "folder")
    .sort((left, right) =>
      left.name.localeCompare(right.name, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );
}

export async function getLibraryPath(
  folderId: string,
): Promise<LibraryFolderEntry[]> {
  if (folderId === ROOT_FOLDER_ID) {
    return [];
  }

  const entries = await readAllEntries();
  const folders = new Map(
    entries
      .filter((entry): entry is LibraryFolderEntry => entry.kind === "folder")
      .map((folder) => [folder.id, folder]),
  );
  const path: LibraryFolderEntry[] = [];
  const visited = new Set<string>();
  let currentId = folderId;

  while (currentId !== ROOT_FOLDER_ID) {
    if (visited.has(currentId)) {
      throw new LibraryError("INVALID_DESTINATION");
    }
    visited.add(currentId);

    const folder = folders.get(currentId);
    if (!folder) {
      throw new LibraryError("NOT_FOUND");
    }
    path.unshift(folder);
    currentId = folder.parentId;
  }

  return path;
}

export async function createLibraryFolder(
  parentId: string,
  requestedName: string,
): Promise<LibraryFolderEntry> {
  const name = normalizeEntryName(requestedName);
  if (!isValidEntryName(name)) {
    throw new LibraryError("INVALID_NAME");
  }

  const entries = await readAllEntries();
  ensureFolderExists(entries, parentId);
  if (hasName(entries, parentId, name)) {
    throw new LibraryError("NAME_EXISTS");
  }

  const now = Date.now();
  const folder: LibraryFolderEntry = {
    id: createId(),
    kind: "folder",
    parentId,
    name,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const database = await openDatabase();
    const transaction = database.transaction(ENTRY_STORE, "readwrite");
    const complete = transactionComplete(transaction);
    transaction.objectStore(ENTRY_STORE).put(folder);
    await complete;
    return folder;
  } catch (error) {
    throw toLibraryError(error);
  }
}

export async function importDrawingToLibrary(
  file: File,
  parentId = ROOT_FOLDER_ID,
): Promise<LibraryDrawingEntry> {
  const format = detectDrawingFormat(file.name);
  if (!format) {
    throw new LibraryError("INVALID_NAME");
  }

  const entries = await readAllEntries();
  ensureFolderExists(entries, parentId);
  const requestedName = normalizeEntryName(file.name);
  if (!isValidEntryName(requestedName)) {
    throw new LibraryError("INVALID_NAME");
  }

  const existing = entries.find(
    (entry): entry is LibraryDrawingEntry =>
      entry.parentId === parentId &&
      entry.kind === "drawing" &&
      entry.name.toLocaleLowerCase() === requestedName.toLocaleLowerCase(),
  );
  const now = Date.now();
  const entry: LibraryDrawingEntry = existing
    ? {
        ...existing,
        format,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        lastModified: file.lastModified || now,
        lastOpenedAt: now,
        updatedAt: now,
      }
    : {
        id: createId(),
        kind: "drawing",
        parentId,
        name: createUniqueEntryName(
          requestedName,
          entries
            .filter((item) => item.parentId === parentId)
            .map((item) => item.name),
        ),
        format,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        lastModified: file.lastModified || now,
        lastOpenedAt: now,
        createdAt: now,
        updatedAt: now,
      };
  const content: LibraryContent = {
    id: entry.id,
    blob: file.slice(0, file.size, entry.mimeType),
  };

  try {
    const database = await openDatabase();
    const transaction = database.transaction(
      [ENTRY_STORE, CONTENT_STORE],
      "readwrite",
    );
    const complete = transactionComplete(transaction);
    transaction.objectStore(ENTRY_STORE).put(entry);
    transaction.objectStore(CONTENT_STORE).put(content);
    await complete;
    return entry;
  } catch (error) {
    throw toLibraryError(error);
  }
}

export async function openLibraryDrawing(
  entryId: string,
): Promise<File> {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(
      [ENTRY_STORE, CONTENT_STORE],
      "readonly",
    );
    const complete = transactionComplete(transaction);
    const [entry, content] = await Promise.all([
      requestResult(transaction.objectStore(ENTRY_STORE).get(entryId)),
      requestResult(transaction.objectStore(CONTENT_STORE).get(entryId)),
    ]);
    await complete;

    const drawing = entry as LibraryEntry | undefined;
    const storedContent = content as LibraryContent | undefined;
    if (!drawing || drawing.kind !== "drawing" || !storedContent?.blob) {
      throw new LibraryError("NOT_FOUND");
    }

    await markLibraryDrawingOpened(drawing.id);
    return new File([storedContent.blob], drawing.name, {
      type: drawing.mimeType,
      lastModified: drawing.lastModified,
    });
  } catch (error) {
    throw toLibraryError(error);
  }
}

async function markLibraryDrawingOpened(entryId: string): Promise<void> {
  const entries = await readAllEntries();
  const entry = entries.find(
    (item): item is LibraryDrawingEntry =>
      item.id === entryId && item.kind === "drawing",
  );
  if (!entry) {
    throw new LibraryError("NOT_FOUND");
  }

  const updated: LibraryDrawingEntry = {
    ...entry,
    lastOpenedAt: Date.now(),
    updatedAt: Date.now(),
  };
  const database = await openDatabase();
  const transaction = database.transaction(ENTRY_STORE, "readwrite");
  const complete = transactionComplete(transaction);
  transaction.objectStore(ENTRY_STORE).put(updated);
  await complete;
}

export async function renameLibraryEntry(
  entryId: string,
  requestedName: string,
): Promise<void> {
  const name = normalizeEntryName(requestedName);
  if (!isValidEntryName(name)) {
    throw new LibraryError("INVALID_NAME");
  }

  const entries = await readAllEntries();
  const entry = entries.find((item) => item.id === entryId);
  if (!entry) {
    throw new LibraryError("NOT_FOUND");
  }
  if (hasName(entries, entry.parentId, name, entry.id)) {
    throw new LibraryError("NAME_EXISTS");
  }
  if (
    entry.kind === "drawing" &&
    detectDrawingFormat(name) !== entry.format
  ) {
    throw new LibraryError("INVALID_NAME");
  }

  const database = await openDatabase();
  const transaction = database.transaction(ENTRY_STORE, "readwrite");
  const complete = transactionComplete(transaction);
  transaction.objectStore(ENTRY_STORE).put({
    ...entry,
    name,
    updatedAt: Date.now(),
  });
  await complete;
}

function descendantIds(
  entries: readonly LibraryEntry[],
  entryId: string,
): Set<string> {
  const descendants = new Set<string>([entryId]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const entry of entries) {
      if (
        !descendants.has(entry.id) &&
        descendants.has(entry.parentId)
      ) {
        descendants.add(entry.id);
        changed = true;
      }
    }
  }

  return descendants;
}

export async function moveLibraryEntry(
  entryId: string,
  destinationFolderId: string,
): Promise<void> {
  const entries = await readAllEntries();
  ensureFolderExists(entries, destinationFolderId);
  const entry = entries.find((item) => item.id === entryId);
  if (!entry) {
    throw new LibraryError("NOT_FOUND");
  }
  if (entry.parentId === destinationFolderId) {
    return;
  }
  if (
    entry.kind === "folder" &&
    descendantIds(entries, entry.id).has(destinationFolderId)
  ) {
    throw new LibraryError("INVALID_DESTINATION");
  }

  const name = createUniqueEntryName(
    entry.name,
    entries
      .filter((item) => item.parentId === destinationFolderId)
      .map((item) => item.name),
  );
  const database = await openDatabase();
  const transaction = database.transaction(ENTRY_STORE, "readwrite");
  const complete = transactionComplete(transaction);
  transaction.objectStore(ENTRY_STORE).put({
    ...entry,
    parentId: destinationFolderId,
    name,
    updatedAt: Date.now(),
  });
  await complete;
}

export async function copyLibraryEntry(
  entryId: string,
  destinationFolderId: string,
): Promise<void> {
  const entries = await readAllEntries();
  ensureFolderExists(entries, destinationFolderId);
  const source = entries.find((entry) => entry.id === entryId);
  if (!source) {
    throw new LibraryError("NOT_FOUND");
  }

  const ids = descendantIds(entries, source.id);
  const sourceEntries = entries.filter((entry) => ids.has(entry.id));
  const sourceDrawings = sourceEntries.filter(
    (entry): entry is LibraryDrawingEntry => entry.kind === "drawing",
  );
  const contents = new Map<string, Blob>();

  if (sourceDrawings.length > 0) {
    const database = await openDatabase();
    const transaction = database.transaction(CONTENT_STORE, "readonly");
    const complete = transactionComplete(transaction);
    const contentStore = transaction.objectStore(CONTENT_STORE);
    const storedContents = await Promise.all(
      sourceDrawings.map((drawing) =>
        requestResult(contentStore.get(drawing.id)),
      ),
    );
    await complete;

    storedContents.forEach((content, index) => {
      const stored = content as LibraryContent | undefined;
      if (!stored?.blob) {
        throw new LibraryError("NOT_FOUND");
      }
      contents.set(sourceDrawings[index].id, stored.blob);
    });
  }

  const idMap = new Map(
    sourceEntries.map((entry) => [entry.id, createId()]),
  );
  const now = Date.now();
  const copiedEntries = sourceEntries.map((entry): LibraryEntry => {
    const isRootCopy = entry.id === source.id;
    const copiedName = isRootCopy
      ? createUniqueEntryName(
          entry.name,
          entries
            .filter((item) => item.parentId === destinationFolderId)
            .map((item) => item.name),
        )
      : entry.name;
    const id = idMap.get(entry.id)!;
    const parentId = isRootCopy
      ? destinationFolderId
      : idMap.get(entry.parentId)!;

    if (entry.kind === "drawing") {
      return {
        ...entry,
        id,
        parentId,
        name: copiedName,
        createdAt: now,
        updatedAt: now,
        lastOpenedAt: now,
      };
    }

    return {
      ...entry,
      id,
      parentId,
      name: copiedName,
      createdAt: now,
      updatedAt: now,
    };
  });

  try {
    const database = await openDatabase();
    const transaction = database.transaction(
      [ENTRY_STORE, CONTENT_STORE],
      "readwrite",
    );
    const complete = transactionComplete(transaction);
    const entryStore = transaction.objectStore(ENTRY_STORE);
    const contentStore = transaction.objectStore(CONTENT_STORE);

    copiedEntries.forEach((entry) => {
      entryStore.put(entry);
      if (entry.kind === "drawing") {
        contentStore.put({
          id: entry.id,
          blob: contents.get(
            sourceEntries.find(
              (sourceEntry) => idMap.get(sourceEntry.id) === entry.id,
            )!.id,
          )!,
        } satisfies LibraryContent);
      }
    });
    await complete;
  } catch (error) {
    throw toLibraryError(error);
  }
}

export async function deleteLibraryEntry(entryId: string): Promise<void> {
  const entries = await readAllEntries();
  const entry = entries.find((item) => item.id === entryId);
  if (!entry) {
    throw new LibraryError("NOT_FOUND");
  }

  const ids = descendantIds(entries, entryId);
  const database = await openDatabase();
  const transaction = database.transaction(
    [ENTRY_STORE, CONTENT_STORE],
    "readwrite",
  );
  const complete = transactionComplete(transaction);
  const entryStore = transaction.objectStore(ENTRY_STORE);
  const contentStore = transaction.objectStore(CONTENT_STORE);
  ids.forEach((id) => {
    entryStore.delete(id);
    contentStore.delete(id);
  });
  await complete;
}

export function unavailableDestinationIds(
  entry: LibraryEntry,
  folders: readonly LibraryFolderEntry[],
): Set<string> {
  if (entry.kind !== "folder") {
    return new Set();
  }

  return descendantIds([entry, ...folders], entry.id);
}
