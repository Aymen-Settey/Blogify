import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider, themeBootstrapScript } from "@/lib/theme";
import { ToastProvider } from "@/components/ui/Toast";
import { KeyboardShortcutsProvider } from "@/components/ui/KeyboardShortcuts";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const fontDisplay = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  axes: ["opsz"],
});

const fontSans = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Blogify — Where Research Meets the World",
  description:
    "An AI-powered research blogging platform connecting researchers, students, and professionals with smart content recommendations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${fontDisplay.variable} ${fontSans.variable} ${fontMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies saved theme before first paint to avoid FOUC. */}
        <script
          dangerouslySetInnerHTML={{ __html: themeBootstrapScript }}
        />
      </head>
      <body className="min-h-screen flex flex-col bg-paper-0 text-ink-8 antialiased font-sans">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-ink-9 focus:px-3 focus:py-2 focus:text-paper-0 focus:shadow-lg"
        >
          Skip to content
        </a>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <KeyboardShortcutsProvider>
                <Navbar />
                <main id="main-content" className="flex-1">
                  {children}
                </main>
                <Footer />
              </KeyboardShortcutsProvider>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
