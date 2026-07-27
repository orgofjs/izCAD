import { useRef, type ChangeEvent } from "react";
import { DRAWING_FILE_ACCEPT } from "../files/fileTypes";
import { useI18n } from "../i18n/I18nProvider";
import { FolderIcon } from "./Icons";

type Props = {
  onFile(file: File): void;
  compact?: boolean;
};

export function OpenFileButton({ onFile, compact = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) {
      onFile(file);
    }
  };

  return (
    <>
      <button
        type="button"
        className={compact ? "open-button compact" : "open-button"}
        onClick={() => inputRef.current?.click()}
      >
        <FolderIcon />
        <span>{compact ? t("chooseAnother") : t("openDrawing")}</span>
      </button>
      <input
        ref={inputRef}
        hidden
        type="file"
        accept={DRAWING_FILE_ACCEPT}
        onChange={handleChange}
      />
    </>
  );
}
