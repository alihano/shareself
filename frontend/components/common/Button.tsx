import type { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "danger" | "success" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  isLoading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-accent to-accent-2 text-white shadow-lg shadow-accent/25 hover:brightness-110 disabled:opacity-40 disabled:shadow-none",
  secondary: "bg-surface-2 text-foreground border border-border hover:border-accent/50 disabled:opacity-40",
  danger: "bg-danger text-white hover:brightness-110 disabled:opacity-40",
  success: "bg-success text-white hover:brightness-110 disabled:opacity-40",
  ghost: "bg-transparent text-muted hover:bg-surface-2 hover:text-foreground disabled:opacity-40",
};

export function Button({
  variant = "primary",
  isLoading = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold",
        "transition-all duration-150 disabled:cursor-not-allowed active:scale-[0.98]",
        variantClasses[variant],
        className
      )}
      disabled={disabled || isLoading}
      {...rest}
    >
      {isLoading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}
