import { useI18n } from "../i18n/I18nProvider";

export function LanguageSwitch() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="language-switch" aria-label={t("language")}>
      <button
        type="button"
        className={locale === "tr" ? "active" : ""}
        aria-pressed={locale === "tr"}
        onClick={() => setLocale("tr")}
      >
        TR
      </button>
      <span aria-hidden="true" />
      <button
        type="button"
        className={locale === "en" ? "active" : ""}
        aria-pressed={locale === "en"}
        onClick={() => setLocale("en")}
      >
        EN
      </button>
    </div>
  );
}

