import type { CSSProperties, ReactNode } from "react";

const P: Record<string, ReactNode> = {
  files: (
    <>
      <path d="M9.5 1.8H4.4A1.4 1.4 0 003 3.2v9.6A1.4 1.4 0 004.4 14h7.2a1.4 1.4 0 001.4-1.4V5.4z" />
      <path d="M9.4 1.8v3.8h3.6" />
    </>
  ),
  search: (
    <>
      <circle cx="7" cy="7" r="4.3" />
      <path d="M13.5 13.5l-3.2-3.2" />
    </>
  ),
  graph: (
    <>
      <circle cx="4" cy="4.5" r="1.9" />
      <circle cx="12" cy="6.5" r="1.9" />
      <circle cx="6.5" cy="12" r="1.9" />
      <path d="M5.7 5.4l4.6 .9M10.8 8.2l-3.4 2.5" />
    </>
  ),
  branch: (
    <>
      <circle cx="4.5" cy="3.4" r="1.7" />
      <circle cx="4.5" cy="12.6" r="1.7" />
      <circle cx="11.5" cy="4.4" r="1.7" />
      <path d="M4.5 5.1v6M11.5 6.1c0 3-2 3.4-4 4-1.5.5-3 1-3 2.3" />
    </>
  ),
  spark: <path d="M8 1.8l1.5 4.4 4.4 1.5-4.4 1.5L8 13.6 6.5 9.2 2.1 7.7l4.4-1.5z" />,
  chev: <path d="M6 3.5l4.5 4.5L6 12.5" />,
  folder: <path d="M2 4.4a1 1 0 011-1h2.8l1.3 1.5H13a1 1 0 011 1V12a1 1 0 01-1 1H3a1 1 0 01-1-1z" />,
  file: (
    <>
      <path d="M9.2 2H5a1.2 1.2 0 00-1.2 1.2v9.6A1.2 1.2 0 005 14h6a1.2 1.2 0 001.2-1.2V5z" />
      <path d="M9.2 2v3h3" />
    </>
  ),
  close: <path d="M4 4l8 8M12 4l-8 8" />,
  send: <path d="M2.5 8h9.5M8 4l4 4-4 4" />,
  sliders: (
    <>
      <path d="M2.5 5h6M11 5h2.5M2.5 11h2.5M8 11h5.5" />
      <circle cx="9.5" cy="5" r="1.5" />
      <circle cx="5" cy="11" r="1.5" />
    </>
  ),
  split: (
    <>
      <rect x="2.2" y="3" width="11.6" height="10" rx="1" />
      <path d="M8 3v10" />
    </>
  ),
};

export function Icon({ name, size = 16, color, style }: { name: string; size?: number; color?: string; style?: CSSProperties }) {
  return (
    <svg className="ic" viewBox="0 0 16 16" style={{ width: size, height: size, color, ...style }}>
      {P[name]}
    </svg>
  );
}
