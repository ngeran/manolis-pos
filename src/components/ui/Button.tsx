"use client";

import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:pointer-events-none";
  const variants = {
    primary: "bg-primary text-on-primary hover:bg-primary/90 shadow-lg",
    secondary:
      "bg-surface-container-low text-primary border border-primary-container hover:bg-primary-container hover:text-on-primary-container",
    ghost:
      "text-on-surface hover:bg-surface-container-high rounded-lg",
    danger: "bg-error text-on-error hover:bg-error/90",
  };
  const sizes = {
    sm: "px-3 py-1 text-sm min-h-[36px]",
    md: "px-6 py-3 min-h-[48px]",
    lg: "px-10 py-6 text-lg min-h-[56px]",
  };

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}
