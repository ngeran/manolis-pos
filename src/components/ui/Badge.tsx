import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  const variants = {
    default: "bg-surface-container-low text-on-surface",
    success: "bg-primary-container text-on-primary",
    warning: "bg-warning-container text-on-warning-container",
    error: "bg-error-container text-error",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-1 rounded-full font-bold text-xs",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
