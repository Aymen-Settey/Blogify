"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";

/**
 * Global keyboard shortcuts.
 *
 *   ⌘/Ctrl + K  →  open command palette (dispatches `blogify:open-command-palette`)
 *   ?           →  open this help modal
 *   g f         →  /feed
 *   g y         →  /for-you
 *   g e         →  /explore
 *   g t         →  /trending
 *   g b         →  /bookmarks
 *   g n         →  /notifications
 *   c           →  /write  (authed users)
 *
 * Respects input focus — shortcuts do not fire while the user is typing
 * in <input>, <textarea>, a contenteditable region, or inside an open
 * dialog that's not the help modal.
 */

type Shortcut = { keys: string; label: string };

const SHORTCUTS: { group: string; items: Shortcut[] }[] = [
  {
    group: "Navigation",
    items: [
      { keys: "g f", label: "Go to Feed" },
      { keys: "g y", label: "Go to For You" },
      { keys: "g e", label: "Go to Explore" },
      { keys: "g t", label: "Go to Trending" },
      { keys: "g b", label: "Go to Bookmarks" },
      { keys: "g n", label: "Go to Notifications" },
    ],
  },
  {
    group: "Actions",
    items: [
      { keys: "⌘ K", label: "Open search" },
      { keys: "c", label: "Compose a post" },
      { keys: "?", label: "Show this help" },
    ],
  },
];

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function KeyboardShortcutsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [helpOpen, setHelpOpen] = React.useState(false);

  // Sequence state for `g ?` combos.
  const pendingRef = React.useRef<{ key: string; at: number } | null>(null);

  React.useEffect(() => {
    pendingRef.current = null;
  }, [pathname]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;

      // ⌘/Ctrl + K — fire a custom event so the nav/command palette can listen.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("blogify:open-command-palette"));
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }

      if (e.key === "Escape") {
        pendingRef.current = null;
        return;
      }

      // Sequence: g then [f|y|e|t|b|n]
      const now = Date.now();
      const pending = pendingRef.current;
      if (pending && now - pending.at < 1200 && pending.key === "g") {
        pendingRef.current = null;
        const dest: Record<string, string> = {
          f: "/feed",
          y: "/for-you",
          e: "/explore",
          t: "/trending",
          b: "/bookmarks",
          n: "/notifications",
        };
        const target = dest[e.key.toLowerCase()];
        if (target) {
          e.preventDefault();
          router.push(target);
          return;
        }
        return;
      }

      if (e.key.toLowerCase() === "g") {
        pendingRef.current = { key: "g", at: now };
        return;
      }

      if (e.key.toLowerCase() === "c") {
        e.preventDefault();
        router.push("/write");
        return;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <>
      {children}
      <Dialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="Keyboard shortcuts"
        description="Move faster with the keyboard."
        size="md"
      >
        <div className="space-y-6">
          {SHORTCUTS.map((group) => (
            <div key={group.group}>
              <p className="kicker mb-3">{group.group}</p>
              <ul className="divide-y divide-ink-2">
                {group.items.map((s) => (
                  <li
                    key={s.keys}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <span className="text-ink-7">{s.label}</span>
                    <kbd className="rounded-md border border-ink-2 bg-paper-1 px-2 py-0.5 font-mono text-xs text-ink-8">
                      {s.keys}
                    </kbd>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Dialog>
    </>
  );
}
