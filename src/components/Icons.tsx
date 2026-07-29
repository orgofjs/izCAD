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

export function PlainFolderIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3.5 7.5v10.25c0 .97.78 1.75 1.75 1.75h13.5c.97 0 1.75-.78 1.75-1.75V8.5c0-.97-.78-1.75-1.75-1.75h-7L9.5 4.5H5.25c-.97 0-1.75.78-1.75 1.75V7.5Z" />
    </IconBase>
  );
}

export function DrawingFileIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 2.75h7.2L18 7.55v13.7H6z" />
      <path d="M13 2.75v5h5M8.7 16.8l2.2-3.1 1.8 1.7 2.5-3.5" />
    </IconBase>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m15 5-7 7 7 7M8 12h11" />
    </IconBase>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m9 5 7 7-7 7" />
    </IconBase>
  );
}

export function MoreIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="5" cy="12" r=".7" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r=".7" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r=".7" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 5v14M5 12h14" />
    </IconBase>
  );
}

export function ImportIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3v12M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4 14.5v5h16v-5" />
    </IconBase>
  );
}

export function RenameIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m4 20 4.1-.9L19 8.2 15.8 5 4.9 15.9 4 20ZM13.8 7l3.2 3.2" />
    </IconBase>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="8" y="8" width="11" height="12" rx="1.5" />
      <path d="M16 8V5.5C16 4.67 15.33 4 14.5 4h-9C4.67 4 4 4.67 4 5.5v10c0 .83.67 1.5 1.5 1.5H8" />
    </IconBase>
  );
}

export function MoveIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 7.5v10.25c0 .97.78 1.75 1.75 1.75h11.5c.97 0 1.75-.78 1.75-1.75V8.5c0-.97-.78-1.75-1.75-1.75H12L9.75 4.5h-4c-.97 0-1.75.78-1.75 1.75V7.5Z" />
      <path d="m9 13 2-2m-2 2 2 2m-2-2h6" />
    </IconBase>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
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
