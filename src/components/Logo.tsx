export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="15" className="fill-accent" />
      <path
        d="M32 50c-9 0-15-6.5-15-15 0-10 8-18 21-20 3-.5 6 0 9 1-1 3-1.5 5-2 8-1.5 14-6 26-13 26z"
        className="fill-accent-ink"
      />
      <path d="M24 44c4-8 9-14 17-20" className="stroke-accent" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}
