import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export function FolderIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3.5 7.5v10.25c0 .97.78 1.75 1.75 1.75h13.5c.97 0 1.75-.78 1.75-1.75V8.5c0-.97-.78-1.75-1.75-1.75h-7L9.5 4.5H5.25c-.97 0-1.75.78-1.75 1.75V7.5Z" />
      <path d="m8.5 13 2.2 2.2 4.8-4.8" />
    </IconBase>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 21s7-3.35 7-9.5V5.2L12 2.5 5 5.2v6.3C5 17.65 12 21 12 21Z" />
      <path d="m9 12 2 2 4-4" />
    </IconBase>
  );
}

export function ZoomInIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.3 15.3 4.2 4.2M10.5 7.5v6M7.5 10.5h6" />
    </IconBase>
  );
}

export function ZoomOutIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.3 15.3 4.2 4.2M7.5 10.5h6" />
    </IconBase>
  );
}

export function FitIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5" />
      <path d="M8.5 8.5h7v7h-7z" />
    </IconBase>
  );
}

export function ResetIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 11a8 8 0 1 1 2.34 5.66" />
      <path d="M4 5v6h6" />
    </IconBase>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </IconBase>
  );
}

