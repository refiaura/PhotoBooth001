type Props = { className?: string; pulse?: boolean; title?: string };

/** Hati dengan bentuk yang sama seperti di photostrip. */
export function Heart({ className = "size-6", pulse = false, title }: Props) {
  return (
    <svg
      viewBox="0 0 1 0.95"
      className={`${className} ${pulse ? "animate-heart-pulse" : ""} text-heart`}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <path
        fill="currentColor"
        d="M0.5 0.95 C0.5 0.95 0 0.62 0 0.3 C0 0.12 0.14 0 0.29 0 C0.4 0 0.47 0.07 0.5 0.15 C0.53 0.07 0.6 0 0.71 0 C0.86 0 1 0.12 1 0.3 C1 0.62 0.5 0.95 0.5 0.95 Z"
      />
    </svg>
  );
}
