type Props = { traveling?: boolean; className?: string };

/**
 * Rute pesawat putus-putus antara dua tempat, motif yang sama dengan header photostrip.
 * `traveling` menggerakkan garis selama masih menunggu pasangan ("lagi di jalan").
 */
export function RouteLine({ traveling = false, className = "" }: Props) {
  return (
    <svg viewBox="0 0 320 56" className={`h-10 w-full text-ink ${className}`} aria-hidden fill="none">
      <path
        d="M14 48 C 90 2, 230 2, 306 48"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="9 9"
        className={traveling ? "animate-route-travel" : undefined}
      />
      <g transform="translate(146 2) rotate(-8)">
        <path
          d="M0 10 L34 0 L22 22 L16 14 Z"
          className="fill-surface"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path d="M16 14 L34 0" stroke="currentColor" strokeWidth="2" />
      </g>
    </svg>
  );
}
