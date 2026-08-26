import clsx from "clsx";

interface LoadingProps {
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = { sm: "h-4 w-4", md: "h-6 w-6", lg: "h-10 w-10" };

export function Loading({ label, className, size = "md" }: LoadingProps) {
  return (
    <div className={clsx("flex flex-col items-center justify-center gap-2 py-8 text-muted", className)}>
      <span
        className={clsx(
          "animate-spin rounded-full border-2 border-accent/30 border-t-accent",
          sizeClasses[size]
        )}
      />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}
