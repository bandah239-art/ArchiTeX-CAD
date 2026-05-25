import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 16, className, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...rest}
    >
      {children}
    </svg>
  );
}

export const ToolIcons = {
  select: (p: IconProps) => (
    <Icon {...p}>
      <path d="M3 3l7 18 2.5-7.5L20 11z" />
    </Icon>
  ),
  orbit: (p: IconProps) => (
    <Icon {...p}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v2M12 18v2M4 12h2M18 12h2" />
    </Icon>
  ),
  pan: (p: IconProps) => (
    <Icon {...p}>
      <path d="M5 9l-3 3 3 3M19 9l3 3-3 3M9 5l3-3 3 3M9 19l3 3 3-3" />
    </Icon>
  ),
  zoom: (p: IconProps) => (
    <Icon {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
    </Icon>
  ),
  walk: (p: IconProps) => (
    <Icon {...p}>
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v5M9 20l3-8 3 8M8 12h8" />
    </Icon>
  ),
  perspective: (p: IconProps) => (
    <Icon {...p}>
      <path d="M4 8l8-4 8 4v8l-8 4-8-4z" />
      <path d="M12 4v16M4 8l8 4 8-4" />
    </Icon>
  ),
  plan: (p: IconProps) => (
    <Icon {...p}>
      <rect x="4" y="4" width="16" height="16" rx="1" />
      <path d="M4 12h16M12 4v16" />
    </Icon>
  ),
  ortho: (p: IconProps) => (
    <Icon {...p}>
      <rect x="5" y="5" width="14" height="14" />
      <path d="M5 12h14M12 5v14" />
    </Icon>
  ),
  fit: (p: IconProps) => (
    <Icon {...p}>
      <path d="M8 3H3v5M16 3h5v5M16 21h5v-5M8 21H3v-5" />
      <rect x="8" y="8" width="8" height="8" rx="1" />
    </Icon>
  ),
  reset: (p: IconProps) => (
    <Icon {...p}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </Icon>
  ),
  explode: (p: IconProps) => (
    <Icon {...p}>
      <rect x="9" y="9" width="6" height="6" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </Icon>
  ),
  xray: (p: IconProps) => (
    <Icon {...p}>
      <rect x="5" y="5" width="14" height="14" opacity="0.4" />
      <rect x="8" y="8" width="8" height="8" />
    </Icon>
  ),
  showAll: (p: IconProps) => (
    <Icon {...p}>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  ),
  grid: (p: IconProps) => (
    <Icon {...p}>
      <rect x="3" y="3" width="18" height="18" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </Icon>
  ),
  snap: (p: IconProps) => (
    <Icon {...p}>
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  ),
  measure: (p: IconProps) => (
    <Icon {...p}>
      <path d="M3 21l18-18" />
      <path d="M6 18l3-3M15 9l3-3" />
    </Icon>
  ),
  angle: (p: IconProps) => (
    <Icon {...p}>
      <path d="M4 20V4h16" />
      <path d="M4 20c6-10 10-14 16-16" />
    </Icon>
  ),
  section: (p: IconProps) => (
    <Icon {...p}>
      <path d="M4 12h16" />
      <path d="M12 4v16" />
      <rect x="6" y="6" width="12" height="12" opacity="0.3" />
    </Icon>
  ),
  snapshot: (p: IconProps) => (
    <Icon {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  ),
  boxSelect: (p: IconProps) => (
    <Icon {...p}>
      <rect x="5" y="5" width="14" height="14" strokeDasharray="3 2" />
      <path d="M3 3l7 18 2.5-7.5L20 11z" opacity="0.5" />
    </Icon>
  ),
  line: (p: IconProps) => (
    <Icon {...p}>
      <path d="M4 20L20 4" />
      <circle cx="4" cy="20" r="1.5" fill="currentColor" />
      <circle cx="20" cy="4" r="1.5" fill="currentColor" />
    </Icon>
  ),
  wall: (p: IconProps) => (
    <Icon {...p}>
      <rect x="4" y="6" width="16" height="12" />
      <path d="M4 12h16M10 6v12M14 6v12" />
    </Icon>
  ),
  slab: (p: IconProps) => (
    <Icon {...p}>
      <path d="M3 12l9-7 9 7-9 7z" />
    </Icon>
  ),
  column: (p: IconProps) => (
    <Icon {...p}>
      <rect x="9" y="4" width="6" height="16" />
    </Icon>
  ),
  pipe: (p: IconProps) => (
    <Icon {...p}>
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="6" r="3" />
      <path d="M8.5 15.5L15.5 8.5" />
    </Icon>
  ),
  polygon: (p: IconProps) => (
    <Icon {...p}>
      <path d="M12 3l8 5v8l-8 5-8-5V8z" />
    </Icon>
  ),
  undo: (p: IconProps) => (
    <Icon {...p}>
      <path d="M3 10h10a5 5 0 0 1 0 10H7" />
      <path d="M3 10l4-4M3 10l4 4" />
    </Icon>
  ),
  redo: (p: IconProps) => (
    <Icon {...p}>
      <path d="M21 10H11a5 5 0 0 0 0 10h6" />
      <path d="M21 10l-4-4M21 10l-4 4" />
    </Icon>
  ),
  geo: (p: IconProps) => (
    <Icon {...p}>
      <circle cx="12" cy="10" r="6" />
      <path d="M12 16c-4 2-8 4-8 6h16c0-2-4-4-8-6z" />
    </Icon>
  ),
  flood: (p: IconProps) => (
    <Icon {...p}>
      <path d="M2 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
      <path d="M2 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
    </Icon>
  ),
  budget: (p: IconProps) => (
    <Icon {...p}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 10h4M7 14h10" />
    </Icon>
  ),
  feasibility: (p: IconProps) => (
    <Icon {...p}>
      <path d="M4 20V4h16v16H4z" />
      <path d="M8 16l3-4 3 2 4-6" />
    </Icon>
  ),
  water: (p: IconProps) => (
    <Icon {...p}>
      <path d="M12 3c4 6 6 9 6 12a6 6 0 1 1-12 0c0-3 2-6 6-12z" />
    </Icon>
  ),
  solar: (p: IconProps) => (
    <Icon {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Icon>
  ),
  seismic: (p: IconProps) => (
    <Icon {...p}>
      <path d="M4 12h4l2-6 4 12 2-6h4" />
    </Icon>
  ),
  boq: (p: IconProps) => (
    <Icon {...p}>
      <path d="M8 4h8v16H8z" />
      <path d="M10 8h4M10 12h4M10 16h4" />
    </Icon>
  ),
  schedule: (p: IconProps) => (
    <Icon {...p}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </Icon>
  ),
  ai: (p: IconProps) => (
    <Icon {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M6 6l1.5 1.5M16.5 16.5L18 18M6 18l1.5-1.5M16.5 7.5L18 6" />
    </Icon>
  ),
  carbon: (p: IconProps) => (
    <Icon {...p}>
      <path d="M12 3c-4 4-6 7-6 10a6 6 0 0 0 12 0c0-3-2-6-6-10z" />
      <path d="M9 14h6" />
    </Icon>
  ),
};
