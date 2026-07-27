import type { AppErrorCode } from "../types/drawing";
import { useI18n } from "../i18n/I18nProvider";
import { OpenFileButton } from "./OpenFileButton";

type Props = {
  code: AppErrorCode;
  onFile(file: File): void;
};

const errorTranslation = {
  UNSUPPORTED_FORMAT: "unsupportedFormat",
  FILE_READ_FAILED: "fileReadFailed",
  DXF_OPEN_FAILED: "dxfOpenFailed",
  DWG_CONVERSION_FAILED: "dwgConversionFailed",
  DWG_RUNTIME_MISSING: "dwgRuntimeMissing",
  RENDER_FAILED: "renderFailed",
} as const;

export function ErrorScreen({ code, onFile }: Props) {
  const { t } = useI18n();

  return (
    <main className="center-screen error-screen">
      <div className="error-symbol" aria-hidden="true">
        !
      </div>
      <p className="eyebrow">izCAD</p>
      <h1>{t("errorTitle")}</h1>
      <p className="error-copy">{t(errorTranslation[code])}</p>
      <OpenFileButton onFile={onFile} />
    </main>
  );
}

