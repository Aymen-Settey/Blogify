"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Sticky reading progress bar. Rendered at the very top of the viewport
 * (under the fixed navbar) with an aurora gradient fill that tracks how
 * far down the reader has scrolled through the referenced article element.
 *
 * Pass a ref to the article container; progress = scrolled / (article height − viewport height).
 */
export function ReadingProgress({
  targetRef,
}: {
  targetRef: React.RefObject<HTMLElement>;
}) {
  const [progress, setProgress] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const compute = () => {
      raf.current = null;
      const el = targetRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewport = window.innerHeight;
      const total = Math.max(1, rect.height - viewport);
      const scrolled = Math.min(total, Math.max(0, -rect.top));
      setProgress(scrolled / total);
    };

    const schedule = () => {
      if (raf.current != null) return;
      raf.current = requestAnimationFrame(compute);
    };

    compute();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [targetRef]);

  return (
    <div
      role="progressbar"
      aria-label="Reading progress"
      aria-valuenow={Math.round(progress * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="fixed top-0 left-0 right-0 z-40 h-[2px] pointer-events-none"
    >
      <div
        className="h-full origin-left bg-aurora-gradient transition-transform duration-150 ease-editorial"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
}
