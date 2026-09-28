import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const CheckIcon = (p: IconProps) => <Icon {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Icon>;
export const XIcon = (p: IconProps) => <Icon {...p}><path d="M6 6l12 12M18 6L6 18" /></Icon>;
export const ArrowRightIcon = (p: IconProps) => <Icon {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>;
export const ArrowLeftIcon = (p: IconProps) => <Icon {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></Icon>;
export const ExternalIcon = (p: IconProps) => <Icon {...p}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></Icon>;
export const ClockIcon = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Icon>;
export const FlameIcon = (p: IconProps) => <Icon {...p}><path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5.5 1-8.5z" /></Icon>;
export const GaugeIcon = (p: IconProps) => <Icon {...p}><path d="M4.5 17a8.5 8.5 0 1 1 15 0" /><path d="M12 13l4-4" /></Icon>;
export const CalendarIcon = (p: IconProps) => <Icon {...p}><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></Icon>;
export const SunIcon = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></Icon>;
export const MoonIcon = (p: IconProps) => <Icon {...p}><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" /></Icon>;
export const MonitorIcon = (p: IconProps) => <Icon {...p}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></Icon>;
export const CloudCheckIcon = (p: IconProps) => <Icon {...p}><path d="M7 18a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.5 1.5A3.75 3.75 0 0 1 17.5 18z" /><path d="m9.5 13 2 2 3.5-3.5" /></Icon>;
export const AlertIcon = (p: IconProps) => <Icon {...p}><path d="M12 4 2.5 20h19z" /><path d="M12 10v4.5M12 17.5v.01" /></Icon>;
export const SpinnerIcon = (p: IconProps) => <Icon {...p}><path d="M12 3a9 9 0 1 0 9 9" /></Icon>;
export const TargetIcon = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.5" /></Icon>;
export const BookIcon = (p: IconProps) => <Icon {...p}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" /></Icon>;
export const LightbulbIcon = (p: IconProps) => <Icon {...p}><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" /></Icon>;
export const DownloadIcon = (p: IconProps) => <Icon {...p}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></Icon>;
export const UploadIcon = (p: IconProps) => <Icon {...p}><path d="M12 20V9M7 14l5-5 5 5M5 4h14" /></Icon>;
export const TrashIcon = (p: IconProps) => <Icon {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></Icon>;
export const RefreshIcon = (p: IconProps) => <Icon {...p}><path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4" /></Icon>;

/** The app mark: a route with three waypoints. */
export function LogoMark(props: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width="1em" height="1em" aria-hidden="true" {...props}>
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <path d="M9 22c0-4 3-5 7-5s7-1 7-5" fill="none" stroke="var(--accent-ink)" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="9" cy="22" r="2.6" fill="var(--accent-ink)" />
      <circle cx="16" cy="17" r="2" fill="var(--accent-ink)" />
      <circle cx="23" cy="12" r="2.6" fill="var(--accent-ink)" />
    </svg>
  );
}
