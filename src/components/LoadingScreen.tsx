import type { LoadingPhase } from "../types/drawing";
import { useI18n } from "../i18n/I18nProvider";

type Props = {
  phase: LoadingPhase;
  progress: number | null;
  fileName: string;
  onCancel(): void;
};

export function LoadingScreen({
  phase,
  progress,
  fileName,
  onCancel,
}: Props) {
  const { t } = useI18n();
  const percent = progress === null ? null : Math.round(progress * 100);

  return (
    <main className="center-screen loading-screen" aria-live="polite">
      <div className="loading-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p className="eyebrow">{fileName}</p>
      <h1>{t(phase)}</h1>
      <div className="progress-track" aria-hidden="true">
        <span
          className={percent === null ? "indeterminate" : ""}
          style={percent === null ? undefined : { width: `${percent}%` }}
        />
      </div>
      {percent !== null && <p className="progress-value">{percent}%</p>}
      <button
        type="button"
        className="cancel-button"
        onClick={onCancel}
      >
        {t("cancel")}
      </button>
    </main>
  );
}
