import clsx from "clsx";

// Deterministic gradient (hashed from the handle) so the same user always
// gets the same colors, without needing to fetch a real avatar image from X
// for arbitrary registered users (see train.md).
const GRADIENTS = [
  ["#8b5cf6", "#ec4899"],
  ["#06b6d4", "#8b5cf6"],
  ["#f59e0b", "#ef4444"],
  ["#22c55e", "#06b6d4"],
  ["#ec4899", "#f59e0b"],
  ["#6366f1", "#22c55e"],
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-xl",
  xl: "h-24 w-24 text-3xl",
};

interface AvatarProps {
  seed: string;
  size?: keyof typeof sizeClasses;
  className?: string;
  imageUrl?: string | null;
}

export function Avatar({ seed, size = "md", className, imageUrl }: AvatarProps) {
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={imageUrl}
        alt={seed}
        className={clsx("rounded-full border-2 border-border object-cover", sizeClasses[size], className)}
      />
    );
  }

  const [from, to] = GRADIENTS[hashString(seed) % GRADIENTS.length];
  const initial = seed.replace("@", "").charAt(0).toUpperCase() || "?";

  return (
    <div
      className={clsx(
        "flex shrink-0 items-center justify-center rounded-full font-bold text-white",
        sizeClasses[size],
        className
      )}
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      {initial}
    </div>
  );
}
