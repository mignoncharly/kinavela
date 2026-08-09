import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-full px-6 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50",
        variant === "primary"
          ? "bg-primary text-primary-foreground hover:bg-primary-strong focus-visible:outline-primary shadow-[0_12px_32px_rgba(159,67,52,0.22)] hover:-translate-y-0.5"
          : "border-border bg-surface text-foreground hover:border-primary/40 hover:bg-surface-elevated focus-visible:outline-primary border",
        className,
      )}
      {...props}
    />
  );
}
