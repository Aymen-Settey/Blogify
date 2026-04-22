"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import {
  Search,
  PenSquare,
  Bell,
  Menu,
  X,
  Bookmark,
  Megaphone,
  ShieldCheck,
  Settings as SettingsIcon,
  LogOut,
  UserCircle2,
  FileText,
} from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { ButtonLink } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const NAV_LINKS: Array<{ href: string; label: string }> = [
  { href: "/feed", label: "Feed" },
  { href: "/for-you", label: "For you" },
  { href: "/explore", label: "Explore" },
  { href: "/trending", label: "Trending" },
];

export function Navbar() {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer on route change.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Global ⌘K listener → navigate to /search.
  useEffect(() => {
    const onOpen = () => router.push("/search");
    window.addEventListener("blogify:open-command-palette", onOpen);
    return () =>
      window.removeEventListener("blogify:open-command-palette", onOpen);
  }, [router]);

  // Scroll-lock while drawer is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-ink-2/70 bg-paper-0/75 backdrop-blur-xl supports-[backdrop-filter]:bg-paper-0/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: wordmark + primary nav */}
        <div className="flex items-center gap-8">
          <Link
            href={user ? "/feed" : "/"}
            className="group flex items-baseline gap-0.5"
            aria-label="Blogify home"
          >
            <span className="font-display text-2xl font-medium tracking-tight text-ink-9">
              Blogify
            </span>
            <span
              className="h-1.5 w-1.5 rounded-full bg-aurora-gradient"
              aria-hidden
            />
          </Link>
          <nav
            className="hidden md:flex items-center gap-1"
            aria-label="Primary"
          >
            {NAV_LINKS.map((link) => {
              const active =
                pathname === link.href ||
                (link.href !== "/" && pathname?.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "relative px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "text-ink-9"
                      : "text-ink-6 hover:text-ink-9",
                  )}
                >
                  <span>{link.label}</span>
                  {active ? (
                    <span
                      aria-hidden
                      className="absolute left-3 right-3 -bottom-px h-0.5 rounded-full bg-aurora-gradient"
                    />
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: search, theme, auth actions */}
        <div className="flex items-center gap-1.5">
          <Link
            href="/search"
            aria-label="Search"
            className="inline-flex h-9 items-center gap-2 rounded-full border border-ink-2 bg-paper-0 px-3 text-xs font-medium text-ink-5 hover:text-ink-9 hover:border-ink-3 transition-colors"
          >
            <Search className="h-4 w-4" />
            <span className="hidden lg:inline">Search</span>
            <kbd className="hidden lg:inline rounded bg-paper-2 px-1.5 py-0.5 text-[10px] font-sans text-ink-5 border border-ink-2">
              ⌘K
            </kbd>
          </Link>

          <ThemeToggle className="hidden sm:inline-flex" />

          {loading ? null : user ? (
            <>
              <ButtonLink
                href="/write"
                size="sm"
                variant="primary"
                leadingIcon={<PenSquare className="h-4 w-4" />}
                className="hidden sm:inline-flex"
              >
                Write
              </ButtonLink>

              <Link
                href="/notifications"
                aria-label="Notifications"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-6 hover:text-ink-9 hover:bg-paper-2 transition-colors"
              >
                <Bell className="h-4.5 w-4.5" />
              </Link>

              <DropdownMenu
                trigger={
                  <Avatar
                    src={user.avatar_url ?? undefined}
                    name={user.display_name || user.username}
                    size="sm"
                  />
                }
                items={[
                  {
                    key: "profile",
                    label: "My profile",
                    href: `/profile/${user.username}`,
                    icon: <UserCircle2 className="h-4 w-4" />,
                  },
                  {
                    key: "bookmarks",
                    label: "Saved posts",
                    href: "/bookmarks",
                    icon: <Bookmark className="h-4 w-4" />,
                  },
                  {
                    key: "my-blogs",
                    label: "My blogs",
                    href: "/my-blogs",
                    icon: <FileText className="h-4 w-4" />,
                  },
                  {
                    key: "campaigns",
                    label: "Campaigns",
                    href: "/advertiser/campaigns",
                    icon: <Megaphone className="h-4 w-4" />,
                  },
                  ...(user.is_admin
                    ? [
                        {
                          key: "admin",
                          label: "Admin · ad review",
                          href: "/admin/ads",
                          icon: <ShieldCheck className="h-4 w-4" />,
                        },
                      ]
                    : []),
                  {
                    key: "settings",
                    label: "Settings",
                    href: "/settings",
                    icon: <SettingsIcon className="h-4 w-4" />,
                  },
                  "separator" as const,
                  {
                    key: "logout",
                    label: "Sign out",
                    onSelect: () => logout(),
                    icon: <LogOut className="h-4 w-4" />,
                    destructive: true,
                  },
                ]}
              />

              {/* Mobile hamburger */}
              <button
                type="button"
                aria-label="Open menu"
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen(true)}
                className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-6 hover:text-ink-9 hover:bg-paper-2 transition-colors"
              >
                <Menu className="h-5 w-5" />
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="hidden sm:inline-flex text-sm font-medium text-ink-7 hover:text-ink-9 px-2"
              >
                Sign in
              </Link>
              <ButtonLink
                href="/auth/register"
                size="sm"
                variant="primary"
              >
                Get started
              </ButtonLink>
              <button
                type="button"
                aria-label="Open menu"
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen(true)}
                className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-6 hover:text-ink-9 hover:bg-paper-2 transition-colors"
              >
                <Menu className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="md:hidden fixed inset-0 z-50 animate-fade-rise">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-ink-9/50 backdrop-blur-sm"
          />
          <div className="absolute right-0 top-0 h-full w-[82%] max-w-sm bg-paper-0 shadow-xl border-l border-ink-2 flex flex-col">
            <div className="flex items-center justify-between h-16 px-5 border-b border-ink-2">
              <span className="font-display text-xl font-medium text-ink-9">
                Menu
              </span>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-6 hover:text-ink-9 hover:bg-paper-2 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav
              className="flex flex-col p-3"
              aria-label="Mobile primary"
            >
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-3 py-3 rounded-lg text-base font-display text-ink-8 hover:bg-paper-2"
                >
                  {link.label}
                </Link>
              ))}
              <div className="h-px bg-ink-2 my-2" />
              <Link
                href="/search"
                className="flex items-center gap-2.5 px-3 py-3 rounded-lg text-sm text-ink-7 hover:bg-paper-2"
              >
                <Search className="h-4 w-4" /> Search
              </Link>
              {user ? (
                <>
                  <Link
                    href="/write"
                    className="flex items-center gap-2.5 px-3 py-3 rounded-lg text-sm text-ink-7 hover:bg-paper-2"
                  >
                    <PenSquare className="h-4 w-4" /> Write a post
                  </Link>
                  <Link
                    href={`/profile/${user.username}`}
                    className="flex items-center gap-2.5 px-3 py-3 rounded-lg text-sm text-ink-7 hover:bg-paper-2"
                  >
                    <UserCircle2 className="h-4 w-4" /> My profile
                  </Link>
                  <Link
                    href="/bookmarks"
                    className="flex items-center gap-2.5 px-3 py-3 rounded-lg text-sm text-ink-7 hover:bg-paper-2"
                  >
                    <Bookmark className="h-4 w-4" /> Saved posts
                  </Link>
                  <Link
                    href="/my-blogs"
                    className="flex items-center gap-2.5 px-3 py-3 rounded-lg text-sm text-ink-7 hover:bg-paper-2"
                  >
                    <FileText className="h-4 w-4" /> My blogs
                  </Link>
                  <Link
                    href="/settings"
                    className="flex items-center gap-2.5 px-3 py-3 rounded-lg text-sm text-ink-7 hover:bg-paper-2"
                  >
                    <SettingsIcon className="h-4 w-4" /> Settings
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      logout();
                    }}
                    className="flex items-center gap-2.5 px-3 py-3 rounded-lg text-sm text-danger hover:bg-danger/10 text-left"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    className="px-3 py-3 rounded-lg text-sm text-ink-7 hover:bg-paper-2"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/auth/register"
                    className="px-3 py-3 rounded-lg text-sm text-ink-7 hover:bg-paper-2"
                  >
                    Create account
                  </Link>
                </>
              )}
            </nav>
            <div className="mt-auto p-4 border-t border-ink-2">
              <ThemeToggle variant="segmented" className="w-full justify-between" />
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
