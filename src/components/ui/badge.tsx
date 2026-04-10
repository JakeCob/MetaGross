import type { HTMLAttributes } from "react";

const variantStyles = {
  default: "bg-zinc-700 text-zinc-100",
  success: "bg-emerald-900/60 text-emerald-300 border-emerald-700/50",
  warning: "bg-amber-900/60 text-amber-300 border-amber-700/50",
  error: "bg-red-900/60 text-red-300 border-red-700/50",
  info: "bg-cyan-900/60 text-cyan-300 border-cyan-700/50",
} as const;

export type BadgeVariant = keyof typeof variantStyles;

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({
  className = "",
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-transparent px-2.5 py-0.5 text-xs font-medium ${variantStyles[variant]} ${className}`}
      {...props}
    />
  );
}
