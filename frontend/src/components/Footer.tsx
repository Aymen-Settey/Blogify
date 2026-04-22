import Link from "next/link";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-ink-2 bg-paper-1">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          {/* Masthead */}
          <div className="max-w-sm">
            <Link
              href="/"
              className="inline-flex items-baseline gap-1"
              aria-label="Blogify home"
            >
              <span className="font-display text-3xl font-medium tracking-tight text-ink-9">
                Blogify
              </span>
              <span
                className="h-2 w-2 rounded-full bg-aurora-gradient"
                aria-hidden
              />
            </Link>
            <p className="mt-4 font-display italic text-lg text-ink-7 leading-snug">
              Where research meets the world — an AI-augmented publication for
              curious minds.
            </p>
          </div>

          {/* Colophon columns */}
          <nav
            aria-label="Footer"
            className="grid grid-cols-2 sm:grid-cols-3 gap-8 sm:gap-14"
          >
            <Column
              title="Read"
              links={[
                { href: "/feed", label: "Feed" },
                { href: "/for-you", label: "For you" },
                { href: "/explore", label: "Explore" },
                { href: "/trending", label: "Trending" },
              ]}
            />
            <Column
              title="Write"
              links={[
                { href: "/write", label: "New post" },
                { href: "/bookmarks", label: "Bookmarks" },
                { href: "/advertiser/campaigns", label: "Campaigns" },
              ]}
            />
            <Column
              title="Publication"
              links={[
                { href: "/about", label: "About" },
                { href: "/privacy", label: "Privacy" },
                { href: "/terms", label: "Terms" },
              ]}
            />
          </nav>
        </div>

        <div className="mt-12 border-t border-ink-2 pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="kicker">© {year} · Blogify</p>
          <p className="text-xs text-ink-5">
            Built with care. Recommendations powered by on-device AI — your
            reading never leaves the page.
          </p>
        </div>
      </div>
    </footer>
  );
}

function Column({
  title,
  links,
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <div>
      <p className="kicker mb-3">{title}</p>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-sm text-ink-7 hover:text-ink-9 transition-colors"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
