import type { ViewerCommand } from "../types/drawing";
import { useI18n } from "../i18n/I18nProvider";
import {
  FitIcon,
  ResetIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "./Icons";

type Props = {
  onCommand(command: ViewerCommand): void;
};

export function ViewerToolbar({ onCommand }: Props) {
  const { t } = useI18n();
  const buttons = [
    { command: "zoom-in" as const, label: t("zoomIn"), Icon: ZoomInIcon },
    { command: "zoom-out" as const, label: t("zoomOut"), Icon: ZoomOutIcon },
    { command: "fit" as const, label: t("fit"), Icon: FitIcon },
    { command: "reset" as const, label: t("reset"), Icon: ResetIcon },
  ];

  return (
    <nav className="viewer-toolbar" aria-label="Viewer controls">
      {buttons.map(({ command, label, Icon }) => (
        <button
          key={command}
          type="button"
          aria-label={label}
          title={label}
          onClick={() => onCommand(command)}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

