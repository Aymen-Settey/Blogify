import * as React from "react";
import { cn } from "@/lib/cn";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-paper-2",
        "before:absolute before:inset-0 before:-translate-x-full",
        "before:bg-gradient-to-r before:from-transparent before:via-paper-1 before:to-transparent",
        "before:animate-[postcard-shimmer_1.6s_ease-in-out_infinite]",
        className,
      )}
      aria-hidden
      {...props}
    />
  );
}

export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

export function SkeletonCard({ index = 0 }: { index?: number } = {}) {
  return (
    <div
      className="rounded-2xl border border-ink-2 bg-paper-0 p-4 flex flex-col gap-3 animate-fade-rise motion-reduce:animate-none"
      style={{ animationDelay: `${Math.min(index, 12) * 50}ms` }}
    >
      <Skeleton className="h-44 w-full rounded-xl" />
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-6 w-5/6" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}
