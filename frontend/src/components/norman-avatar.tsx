type NormanAvatarProps = {
  mood?: "ready" | "working" | "attention";
  className?: string;
};

/** Decorative face; the adjacent text always communicates the actual state. */
export function NormanAvatar({ mood = "ready", className = "h-12 w-12" }: NormanAvatarProps) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false" className={`shrink-0 ${className}`}>
      <circle cx="32" cy="32" r="29" fill="var(--surface-soft, #ecf2ff)" />
      <circle cx="32" cy="32" r="28" stroke="var(--accent, #4f7ed9)" strokeWidth="2" />
      <g fill="var(--foreground, #1b2554)">
        <rect x="21" y="24" width="5" height="8" rx="2.5" />
        <rect x="38" y="24" width="5" height="8" rx="2.5" />
      </g>
      <g stroke="var(--foreground, #1b2554)" strokeWidth="2.5" strokeLinecap="round">
        {mood === "ready" && <path d="M25 39c3.5 5 10.5 5 14 0" />}
        {mood === "working" && <path d="M28 41h8" />}
        {mood === "attention" && <path d="M27 42c2.5-2 7.5-2 10 0" />}
      </g>
    </svg>
  );
}
