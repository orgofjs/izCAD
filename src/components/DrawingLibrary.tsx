import {
  type ChangeEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DRAWING_FILE_ACCEPT } from "../files/fileTypes";
import { useI18n } from "../i18n/I18nProvider";
import {
  copyLibraryEntry,
  createLibraryFolder,
  deleteLibraryEntry,
  getLibraryPath,
  importDrawingToLibrary,
  LibraryError,
  type LibraryEntry,
  type LibraryFolderEntry,
  listLibraryChildren,
  listLibraryFolders,
  listRecentDrawings,
  moveLibraryEntry,
  openLibraryDrawing,
  renameLibraryEntry,
  requestPersistentLibraryStorage,
  ROOT_FOLDER_ID,
  unavailableDestinationIds,
} from "../library/drawingLibrary";
import type { TranslationKey } from "../i18n/translations";
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  CopyIcon,
  DrawingFileIcon,
  ImportIcon,
  MoreIcon,
  MoveIcon,
  PlainFolderIcon,
  PlusIcon,
  RenameIcon,
  TrashIcon,
} from "./Icons";
import { LanguageSwitch } from "./LanguageSwitch";

type Props = {
  onOpen(file: File, libraryEntryId: string): void | Promise<void>;
  onClose(): void;
};

type TextDialogState =
  | { type: "create-folder"; value: string }
  | { type: "rename"; value: string; entry: LibraryEntry };

type DestinationDialogState = {
  operation: "copy" | "move";
  entry: LibraryEntry;
};

function formatBytes(bytes: number, locale: string): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length,
  );
  const value = bytes / 1024 ** exponent;
  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  }).format(value)} ${units[exponent - 1]}`;
}

function formatDate(timestamp: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(timestamp);
}

function stopPropagation(event: MouseEvent<HTMLButtonElement>): void {
  event.stopPropagation();
}

function libraryErrorKey(error: unknown): TranslationKey {
  if (!(error instanceof LibraryError)) {
    return "libraryOperationFailed";
  }

  switch (error.code) {
    case "INVALID_NAME":
      return "invalidLibraryName";
    case "NAME_EXISTS":
      return "libraryNameExists";
    case "INVALID_DESTINATION":
      return "invalidLibraryDestination";
    case "STORAGE_FULL":
      return "libraryStorageFull";
    case "STORAGE_UNAVAILABLE":
    case "NOT_FOUND":
      return "libraryStorageUnavailable";
  }
}

function folderLabel(
  folder: LibraryFolderEntry,
  folders: readonly LibraryFolderEntry[],
  rootLabel: string,
): string {
  const byId = new Map(folders.map((item) => [item.id, item]));
  const names = [folder.name];
  const visited = new Set([folder.id]);
  let parentId = folder.parentId;

  while (parentId !== ROOT_FOLDER_ID) {
    if (visited.has(parentId)) {
      break;
    }
    visited.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) {
      break;
    }
    names.unshift(parent.name);
    parentId = parent.parentId;
  }

  return `${rootLabel} / ${names.join(" / ")}`;
}

export function DrawingLibrary({ onOpen, onClose }: Props) {
  const { locale, t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [currentFolderId, setCurrentFolderId] = useState(ROOT_FOLDER_ID);
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [recentEntries, setRecentEntries] = useState<LibraryEntry[]>([]);
  const [path, setPath] = useState<LibraryFolderEntry[]>([]);
  const [allFolders, setAllFolders] = useState<LibraryFolderEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<LibraryEntry | null>(null);
  const [textDialog, setTextDialog] = useState<TextDialogState | null>(null);
  const [destinationDialog, setDestinationDialog] =
    useState<DestinationDialogState | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<LibraryEntry | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [children, folderPath, recent, folders] = await Promise.all([
        listLibraryChildren(currentFolderId),
        getLibraryPath(currentFolderId),
        currentFolderId === ROOT_FOLDER_ID
          ? listRecentDrawings()
          : Promise.resolve([]),
        listLibraryFolders(),
      ]);
      setEntries(children);
      setPath(folderPath);
      setRecentEntries(recent);
      setAllFolders(folders);
    } catch (error) {
      setNotice(t(libraryErrorKey(error)));
    } finally {
      setLoading(false);
    }
  }, [currentFolderId, t]);

  useEffect(() => {
    void requestPersistentLibraryStorage();
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeout = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const runOperation = useCallback(
    async (operation: () => Promise<void>, successKey?: TranslationKey) => {
      setBusy(true);
      try {
        await operation();
        if (successKey) {
          setNotice(t(successKey));
        }
        await reload();
      } catch (error) {
        setNotice(t(libraryErrorKey(error)));
      } finally {
        setBusy(false);
      }
    },
    [reload, t],
  );

  const openEntry = useCallback(
    async (entry: LibraryEntry) => {
      if (entry.kind === "folder") {
        setCurrentFolderId(entry.id);
        return;
      }

      setBusy(true);
      try {
        const file = await openLibraryDrawing(entry.id);
        await onOpen(file, entry.id);
      } catch (error) {
        setNotice(t(libraryErrorKey(error)));
        setBusy(false);
      }
    },
    [onOpen, t],
  );

  const handleImport = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) {
        return;
      }

      setBusy(true);
      try {
        const entry = await importDrawingToLibrary(file, currentFolderId);
        const storedFile = await openLibraryDrawing(entry.id);
        await onOpen(storedFile, entry.id);
      } catch (error) {
        setNotice(t(libraryErrorKey(error)));
        setBusy(false);
      }
    },
    [currentFolderId, onOpen, t],
  );

  const submitTextDialog = useCallback(() => {
    if (!textDialog) {
      return;
    }

    const dialog = textDialog;
    setTextDialog(null);
    if (dialog.type === "create-folder") {
      void runOperation(
        () => createLibraryFolder(currentFolderId, dialog.value).then(() => undefined),
        "folderCreated",
      );
      return;
    }

    void runOperation(
      () => renameLibraryEntry(dialog.entry.id, dialog.value),
      "renamed",
    );
  }, [currentFolderId, runOperation, textDialog]);

  const unavailableDestinations = useMemo(
    () =>
      destinationDialog
        ? unavailableDestinationIds(destinationDialog.entry, allFolders)
        : new Set<string>(),
    [allFolders, destinationDialog],
  );

  const chooseDestination = useCallback(
    (destinationFolderId: string) => {
      if (!destinationDialog) {
        return;
      }

      const { entry, operation } = destinationDialog;
      setDestinationDialog(null);
      void runOperation(
        () =>
          operation === "copy"
            ? copyLibraryEntry(entry.id, destinationFolderId)
            : moveLibraryEntry(entry.id, destinationFolderId),
        operation === "copy" ? "copied" : "moved",
      );
    },
    [destinationDialog, runOperation],
  );

  const goBack = useCallback(() => {
    if (path.length === 0) {
      onClose();
      return;
    }

    setCurrentFolderId(
      path.length === 1 ? ROOT_FOLDER_ID : path[path.length - 2].id,
    );
  }, [onClose, path]);

  return (
    <div className="app-shell library-shell" aria-busy={busy}>
      <header className="library-topbar">
        <button
          type="button"
          className="icon-button"
          aria-label={t("back")}
          title={t("back")}
          onClick={goBack}
        >
          <ArrowLeftIcon />
        </button>
        <div className="library-heading">
          <strong>{t("libraryTitle")}</strong>
          <span>{t("librarySubtitle")}</span>
        </div>
        <LanguageSwitch />
        <button
          type="button"
          className="icon-button library-close"
          aria-label={t("closeLibrary")}
          title={t("closeLibrary")}
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </header>

      <main className="library-content">
        <nav className="library-breadcrumbs" aria-label={t("mainFolder")}>
          <button
            type="button"
            className={path.length === 0 ? "active" : ""}
            onClick={() => setCurrentFolderId(ROOT_FOLDER_ID)}
          >
            {t("mainFolder")}
          </button>
          {path.map((folder, index) => (
            <span key={folder.id}>
              <ChevronRightIcon />
              <button
                type="button"
                className={index === path.length - 1 ? "active" : ""}
                onClick={() => setCurrentFolderId(folder.id)}
              >
                {folder.name}
              </button>
            </span>
          ))}
        </nav>

        <div className="library-primary-actions">
          <button
            type="button"
            className="open-button compact library-import-button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <ImportIcon />
            <span>{t("importDrawing")}</span>
          </button>
          <button
            type="button"
            className="library-secondary-button"
            disabled={busy}
            onClick={() =>
              setTextDialog({ type: "create-folder", value: "" })
            }
          >
            <PlusIcon />
            <span>{t("newFolder")}</span>
          </button>
          <input
            ref={inputRef}
            hidden
            type="file"
            accept={DRAWING_FILE_ACCEPT}
            onChange={handleImport}
          />
        </div>

        {recentEntries.length > 0 ? (
          <section className="recent-section">
            <h2>{t("recentDrawings")}</h2>
            <div className="recent-list">
              {recentEntries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="recent-card"
                  disabled={busy}
                  onClick={() => void openEntry(entry)}
                >
                  <span className="recent-format">{entry.kind === "drawing" ? entry.format : ""}</span>
                  <strong>{entry.name}</strong>
                  {entry.kind === "drawing" ? (
                    <small>{formatBytes(entry.size, locale)}</small>
                  ) : null}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="library-entries-section">
          <h2>{t("filesAndFolders")}</h2>
          {loading ? (
            <div className="library-loading" aria-label={t("loading")}>
              <span />
              <span />
              <span />
            </div>
          ) : entries.length === 0 ? (
            <div className="library-empty">
              <PlainFolderIcon />
              <strong>{t("emptyFolderTitle")}</strong>
              <p>{t("emptyFolderDescription")}</p>
            </div>
          ) : (
            <div className="library-entry-list">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="library-entry"
                  role="button"
                  tabIndex={0}
                  onClick={() => void openEntry(entry)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      void openEntry(entry);
                    }
                  }}
                >
                  <span
                    className={`library-entry-icon ${entry.kind}`}
                    aria-hidden="true"
                  >
                    {entry.kind === "folder" ? (
                      <PlainFolderIcon />
                    ) : (
                      <DrawingFileIcon />
                    )}
                  </span>
                  <span className="library-entry-copy">
                    <strong>{entry.name}</strong>
                    <small>
                      {entry.kind === "folder"
                        ? formatDate(entry.updatedAt, locale)
                        : `${entry.format.toUpperCase()} · ${formatBytes(entry.size, locale)} · ${formatDate(entry.updatedAt, locale)}`}
                    </small>
                  </span>
                  {entry.kind === "folder" ? (
                    <ChevronRightIcon className="entry-chevron" />
                  ) : null}
                  <button
                    type="button"
                    className="entry-more-button"
                    aria-label={`${t("itemActions")}: ${entry.name}`}
                    title={t("itemActions")}
                    disabled={busy}
                    onClick={(event) => {
                      stopPropagation(event);
                      setSelectedEntry(entry);
                    }}
                  >
                    <MoreIcon />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {notice ? (
        <div className="library-notice" role="status">
          {notice}
        </div>
      ) : null}

      {busy ? (
        <div className="library-busy" aria-hidden="true">
          <span />
        </div>
      ) : null}

      {selectedEntry ? (
        <div
          className="library-modal-backdrop action-sheet-backdrop"
          onClick={() => setSelectedEntry(null)}
        >
          <section
            className="library-action-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={t("itemActions")}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="action-sheet-handle" />
            <strong className="action-sheet-title">{selectedEntry.name}</strong>
            <div className="action-sheet-grid">
              <button
                type="button"
                onClick={() => {
                  setTextDialog({
                    type: "rename",
                    value: selectedEntry.name,
                    entry: selectedEntry,
                  });
                  setSelectedEntry(null);
                }}
              >
                <RenameIcon />
                <span>{t("rename")}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDestinationDialog({
                    operation: "copy",
                    entry: selectedEntry,
                  });
                  setSelectedEntry(null);
                }}
              >
                <CopyIcon />
                <span>{t("copy")}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDestinationDialog({
                    operation: "move",
                    entry: selectedEntry,
                  });
                  setSelectedEntry(null);
                }}
              >
                <MoveIcon />
                <span>{t("move")}</span>
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  setDeleteEntry(selectedEntry);
                  setSelectedEntry(null);
                }}
              >
                <TrashIcon />
                <span>{t("delete")}</span>
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {textDialog ? (
        <div
          className="library-modal-backdrop"
          onClick={() => setTextDialog(null)}
        >
          <form
            className="library-dialog"
            onSubmit={(event) => {
              event.preventDefault();
              submitTextDialog();
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <h2>
              {textDialog.type === "create-folder"
                ? t("newFolder")
                : t("rename")}
            </h2>
            <label>
              <span>
                {textDialog.type === "create-folder"
                  ? t("folderName")
                  : t("rename")}
              </span>
              <input
                autoFocus
                value={textDialog.value}
                maxLength={220}
                onChange={(event) =>
                  setTextDialog({ ...textDialog, value: event.target.value })
                }
              />
            </label>
            <div className="dialog-actions">
              <button
                type="button"
                className="dialog-cancel"
                onClick={() => setTextDialog(null)}
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                className="dialog-confirm"
                disabled={!textDialog.value.trim()}
              >
                {textDialog.type === "create-folder"
                  ? t("create")
                  : t("save")}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {destinationDialog ? (
        <div
          className="library-modal-backdrop"
          onClick={() => setDestinationDialog(null)}
        >
          <section
            className="library-dialog destination-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={t("chooseDestination")}
            onClick={(event) => event.stopPropagation()}
          >
            <h2>{t("chooseDestination")}</h2>
            <div className="destination-list">
              <button
                type="button"
                disabled={unavailableDestinations.has(ROOT_FOLDER_ID)}
                onClick={() => chooseDestination(ROOT_FOLDER_ID)}
              >
                <PlainFolderIcon />
                <span>{t("mainFolder")}</span>
              </button>
              {allFolders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  disabled={unavailableDestinations.has(folder.id)}
                  onClick={() => chooseDestination(folder.id)}
                >
                  <PlainFolderIcon />
                  <span>{folderLabel(folder, allFolders, t("mainFolder"))}</span>
                </button>
              ))}
            </div>
            <div className="dialog-actions">
              <button
                type="button"
                className="dialog-cancel"
                onClick={() => setDestinationDialog(null)}
              >
                {t("cancel")}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {deleteEntry ? (
        <div
          className="library-modal-backdrop"
          onClick={() => setDeleteEntry(null)}
        >
          <section
            className="library-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-label={t("deleteTitle")}
            onClick={(event) => event.stopPropagation()}
          >
            <h2>{t("deleteTitle")}</h2>
            <p>
              {deleteEntry.kind === "folder"
                ? t("deleteFolderDescription")
                : t("deleteDrawingDescription")}
            </p>
            <div className="dialog-actions">
              <button
                type="button"
                className="dialog-cancel"
                onClick={() => setDeleteEntry(null)}
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                className="dialog-delete"
                onClick={() => {
                  const entry = deleteEntry;
                  setDeleteEntry(null);
                  void runOperation(
                    () => deleteLibraryEntry(entry.id),
                    "deleted",
                  );
                }}
              >
                {t("delete")}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
