"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Notification } from "@/lib/types";
import {
  Bell,
  Check,
  Heart,
  MessageCircle,
  UserPlus,
  Repeat,
  Sparkles,
} from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export default function NotificationsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const data = await apiFetch<Notification[]>("/api/notifications");
        setItems(data);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const markAllRead = async () => {
    try {
      await apiFetch("/api/notifications/read-all", { method: "POST" });
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // silent
    }
  };

  const markRead = async (id: string) => {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: "POST" });
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
    } catch {
      // silent
    }
  };

  if (authLoading || !user) return null;

  const unread = items.filter((n) => !n.read).length;

  return (
    <main className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-14">
      <SectionHeader
        kicker="The wire"
        title="Notifications"
        description={
          unread > 0 ? `${unread} unread` : "You're all caught up."
        }
        action={
          unread > 0 ? (
            <Button
              onClick={markAllRead}
              variant="secondary"
              size="sm"
              leadingIcon={<Check className="h-4 w-4" />}
            >
              Mark all read
            </Button>
          ) : undefined
        }
      />

      <div className="mt-10">
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-16 bg-paper-2 rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <Bell className="h-12 w-12 text-ink-3 mx-auto mb-3" />
            <p className="font-display italic text-ink-6">
              No notifications yet.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((n) => (
              <NotificationRow
                key={n.id}
                notification={n}
                onMarkRead={markRead}
              />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function NotificationRow({
  notification: n,
  onMarkRead,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
}) {
  const { icon: Icon, tint, aurora } = iconFor(n.type);
  const created = new Date(n.created_at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const message = (n.payload?.message as string) || defaultMessage(n.type);
  const href = (n.payload?.href as string) || "#";

  return (
    <li>
      <Link
        href={href}
        onClick={() => !n.read && onMarkRead(n.id)}
        className={cn(
          "flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors",
          n.read
            ? "border-ink-2 bg-paper-0 hover:bg-paper-1"
            : "border-brand-300/60 bg-brand-50/40 hover:bg-brand-50/70",
          aurora && !n.read && "aurora-rail pl-5",
        )}
      >
        <div
          className={cn(
            "flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center",
            tint,
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-ink-8">{message}</p>
          <p className="text-xs text-ink-4 mt-0.5">{created}</p>
        </div>
        {!n.read && (
          <span
            className={cn(
              "h-2 w-2 rounded-full mt-2",
              aurora ? "bg-aurora-gradient" : "bg-brand-500",
            )}
          />
        )}
      </Link>
    </li>
  );
}

function iconFor(type: string): {
  icon: React.ComponentType<{ className?: string }>;
  tint: string;
  aurora?: boolean;
} {
  switch (type) {
    case "like":
      return { icon: Heart, tint: "bg-danger/10 text-danger" };
    case "comment":
    case "reply":
      return { icon: MessageCircle, tint: "bg-brand-50 text-brand-700" };
    case "follow":
      return { icon: UserPlus, tint: "bg-success/10 text-success" };
    case "repost":
      return { icon: Repeat, tint: "bg-paper-2 text-ink-7" };
    case "mention":
    case "recommendation":
      return {
        icon: Sparkles,
        tint: "bg-aurora-gradient text-paper-0",
        aurora: true,
      };
    default:
      return { icon: Bell, tint: "bg-paper-2 text-ink-6" };
  }
}

function defaultMessage(type: string): string {
  switch (type) {
    case "like":
      return "Someone liked your post";
    case "comment":
      return "New comment on your post";
    case "reply":
      return "Someone replied to your comment";
    case "follow":
      return "You have a new follower";
    case "repost":
      return "Someone reposted your work";
    case "mention":
      return "You were mentioned";
    case "recommendation":
      return "New recommendation for you";
    default:
      return "You have a new notification";
  }
}
