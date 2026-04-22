import * as React from "react";
import { cn } from "@/lib/cn";

type Variant = "plain" | "editorial" | "elevated" | "aurora-rail";

const variants: Record<Variant, string> = {
  plain:
    "bg-paper-0 border border-ink-2 rounded-2xl",
  editorial:
    "bg-paper-0 border border-ink-2 rounded-2xl shadow-editorial",
  elevated:
    "bg-paper-0 border border-ink-2 rounded-2xl shadow-lg",
  "aurora-rail":
    "aurora-rail bg-paper-0 border border-ink-2 rounded-2xl pl-[2px]",
};

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: Variant;
  as?: keyof JSX.IntrinsicElements;
  interactive?: boolean;
};

export function Card({
  variant = "plain",
  as: Tag = "div",
  interactive,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <Tag
      className={cn(
        variants[variant],
        "transition-all duration-300 ease-editorial",
        interactive &&
          "hover:-translate-y-0.5 hover:shadow-lg hover:border-ink-3",
        className,
      )}
      {...(props as React.HTMLAttributes<HTMLElement>)}
    >
      {children as React.ReactNode}
    </Tag>
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pb-3", className)} {...props} />;
}

export function CardBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-3", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "p-6 pt-3 border-t border-ink-2 flex items-center justify-between gap-3",
        className,
      )}
      {...props}
    />
  );
}
