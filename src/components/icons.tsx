import type { ReactNode } from "react";
import type { PlaylistIcons } from "../types";
import { cx } from "../utils/cx";

function Icon({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <svg
      className={cx("surfbort-icon", className)}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" } as const;

const speaker = (
  <path d="M3.5 9.75v4.5c0 .69.56 1.25 1.25 1.25H7.5l4.36 3.63c.65.54 1.64.08 1.64-.77V5.64c0-.85-.99-1.31-1.64-.77L7.5 8.5H4.75c-.69 0-1.25.56-1.25 1.25Z" />
);

export const defaultIcons: PlaylistIcons = {
  play: (
    <Icon>
      <path d="M8.5 5.6v12.8a1 1 0 0 0 1.53.85l10.2-6.4a1 1 0 0 0 0-1.7l-10.2-6.4A1 1 0 0 0 8.5 5.6Z" />
    </Icon>
  ),
  pause: (
    <Icon>
      <rect x="6" y="5" width="4" height="14" rx="1.2" />
      <rect x="14" y="5" width="4" height="14" rx="1.2" />
    </Icon>
  ),
  previous: (
    <Icon>
      <rect x="4.5" y="5" width="2.5" height="14" rx="1.1" />
      <path d="M19.5 6.2v11.6a1 1 0 0 1-1.53.85l-9.3-5.8a1 1 0 0 1 0-1.7l9.3-5.8a1 1 0 0 1 1.53.85Z" />
    </Icon>
  ),
  next: (
    <Icon>
      <rect x="17" y="5" width="2.5" height="14" rx="1.1" />
      <path d="M4.5 6.2v11.6a1 1 0 0 0 1.53.85l9.3-5.8a1 1 0 0 0 0-1.7l-9.3-5.8A1 1 0 0 0 4.5 6.2Z" />
    </Icon>
  ),
  volume: (
    <Icon>
      {speaker}
      <path d="M16.5 8.6a4.8 4.8 0 0 1 0 6.8" {...stroke} />
      <path d="M19.2 5.9a8.6 8.6 0 0 1 0 12.2" {...stroke} />
    </Icon>
  ),
  muted: (
    <Icon>
      {speaker}
      <path d="m16.75 9.75 4.5 4.5m0-4.5-4.5 4.5" {...stroke} />
    </Icon>
  ),
  loading: (
    <Icon className="surfbort-spinner">
      <circle cx="12" cy="12" r="8" {...stroke} strokeWidth={2.5} strokeOpacity={0.25} />
      <path d="M20 12a8 8 0 0 0-8-8" {...stroke} strokeWidth={2.5} />
    </Icon>
  ),
};
