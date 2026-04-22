"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "aurora" | "danger" | "link";
type Size = "sm" | "md" | "lg" | "icon";
type Shape = "pill" | "square";

const base =
  "relative inline-flex items-center justify-center gap-2 font-sans font-medium " +
  "transition-colors duration-200 ease-editorial " +
  "disabled:opacity-50 disabled:cursor-not-allowed select-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-ink-9 text-paper-0 hover:bg-ink-8 shadow-sm",
  secondary:
    "bg-paper-0 text-ink-8 border border-ink-2 hover:bg-paper-1 hover:border-ink-3",
  ghost:
    "bg-transparent text-ink-7 hover:bg-paper-2 hover:text-ink-9",
  aurora:
    "text-paper-0 bg-aurora-gradient bg-[length:200%_100%] hover:animate-aurora-sweep shadow-glow-aurora",
  danger:
    "bg-danger text-paper-0 hover:brightness-110 shadow-sm",
  link:
    "bg-transparent text-brand-600 hover:text-brand-700 underline-offset-4 hover:underline p-0",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
  icon: "h-9 w-9 p-0",
};

const shapes: Record<Shape, string> = {
  pill: "rounded-full",
  square: "rounded-lg",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  shape?: Shape;
  loading?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = "primary",
      size = "md",
      shape = "pill",
      loading,
      leadingIcon,
      trailingIcon,
      children,
      disabled,
      type,
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        disabled={disabled || loading}
        className={cn(
          base,
          variants[variant],
          sizes[size],
          variant === "link" ? undefined : shapes[shape],
          className,
        )}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          leadingIcon
        )}
        {children}
        {!loading && trailingIcon}
      </button>
    );
  },
);

/**
 * Styled next/link that matches Button’s visual language. Used for
 * navigation-as-CTA, where semantics should stay anchor, not button.
 */
export type ButtonLinkProps = React.ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: Size;
  shape?: Shape;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
};

export function ButtonLink({
  className,
  variant = "primary",
  size = "md",
  shape = "pill",
  leadingIcon,
  trailingIcon,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(
        base,
        variants[variant],
        sizes[size],
        variant === "link" ? undefined : shapes[shape],
        className,
      )}
      {...props}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </Link>
  );
}
