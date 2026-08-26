export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={`gradient-ring relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-lg shadow-accent/30 ${className ?? "h-9 w-9"}`}
    >
      {/* Subtle sheen for depth */}
      <span className="absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-black/10" />
      <svg viewBox="0 0 24 24" fill="none" className="relative h-[55%] w-[55%]" aria-hidden="true">
        {/* Ascending share-price sparkline with a highlighted peak — ties the mark to bonding-curve pricing */}
        <path
          d="M3 16.5L9 10.5L13 14L21 5"
          stroke="white"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M15 5H21V11"
          stroke="white"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="21" cy="5" r="2.1" fill="white" />
      </svg>
    </span>
  );
}
