import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

/**
 * Token-backed Tailwind config.
 *
 * All colour / radius / shadow values are read from CSS custom properties
 * declared in `src/app/globals.css`. Light and dark themes swap those
 * variables; Tailwind classes never need to know which theme is active.
 *
 * Palette layers:
 *   - `paper` / `ink`  → neutral surfaces and text (replaces ad-hoc slate-*).
 *   - `brand`          → primary CTA + link colour only.
 *   - `aurora`         → reserved exclusively for AI-origin affordances.
 *   - `warn/success/danger` → semantic accents.
 */
const tokenColor = (name: string) =>
  `rgb(var(--color-${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        paper: {
          0: tokenColor("paper-0"),
          1: tokenColor("paper-1"),
          2: tokenColor("paper-2"),
          3: tokenColor("paper-3"),
          4: tokenColor("paper-4"),
        },
        ink: {
          0: tokenColor("ink-0"),
          1: tokenColor("ink-1"),
          2: tokenColor("ink-2"),
          3: tokenColor("ink-3"),
          4: tokenColor("ink-4"),
          5: tokenColor("ink-5"),
          6: tokenColor("ink-6"),
          7: tokenColor("ink-7"),
          8: tokenColor("ink-8"),
          9: tokenColor("ink-9"),
        },
        brand: {
          50: tokenColor("brand-50"),
          100: tokenColor("brand-100"),
          200: tokenColor("brand-200"),
          300: tokenColor("brand-300"),
          400: tokenColor("brand-400"),
          500: tokenColor("brand-500"),
          600: tokenColor("brand-600"),
          700: tokenColor("brand-700"),
          800: tokenColor("brand-800"),
          900: tokenColor("brand-900"),
          950: tokenColor("brand-950"),
        },
        aurora: {
          from: tokenColor("aurora-from"),
          via: tokenColor("aurora-via"),
          to: tokenColor("aurora-to"),
          tint: tokenColor("aurora-tint"),
          ink: tokenColor("aurora-ink"),
        },
        warn: tokenColor("accent-warn"),
        success: tokenColor("accent-success"),
        danger: tokenColor("accent-danger"),
        // Transitional aliases so surfaces not yet migrated keep rendering.
        // Remove once `grep -R "slate-" src/` returns nothing outside ui/.
        slate: {
          50: tokenColor("paper-1"),
          100: tokenColor("paper-2"),
          200: tokenColor("paper-3"),
          300: tokenColor("paper-4"),
          400: tokenColor("ink-4"),
          500: tokenColor("ink-5"),
          600: tokenColor("ink-6"),
          700: tokenColor("ink-7"),
          800: tokenColor("ink-8"),
          900: tokenColor("ink-9"),
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
        sans: [
          "var(--font-sans)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        mono: [
          "var(--font-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      fontSize: {
        "display-xl": [
          "clamp(3.5rem, 7vw, 6rem)",
          { lineHeight: "1.02", letterSpacing: "-0.035em" },
        ],
        "display-lg": [
          "clamp(2.75rem, 5.5vw, 4.25rem)",
          { lineHeight: "1.05", letterSpacing: "-0.03em" },
        ],
        "display-md": [
          "clamp(2rem, 3.5vw, 2.75rem)",
          { lineHeight: "1.1", letterSpacing: "-0.02em" },
        ],
        kicker: ["0.6875rem", { lineHeight: "1", letterSpacing: "0.18em" }],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius-md)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
        "3xl": "var(--radius-3xl)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-md)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        editorial: "var(--shadow-editorial)",
        "glow-aurora": "var(--shadow-glow-aurora)",
      },
      backgroundImage: {
        "aurora-gradient":
          "linear-gradient(135deg, rgb(var(--color-aurora-from)) 0%, rgb(var(--color-aurora-via)) 55%, rgb(var(--color-aurora-to)) 100%)",
        "aurora-mesh":
          "radial-gradient(60% 80% at 20% 10%, rgb(var(--color-aurora-from) / 0.22) 0%, transparent 60%), radial-gradient(50% 60% at 85% 25%, rgb(var(--color-aurora-to) / 0.18) 0%, transparent 65%), radial-gradient(40% 55% at 50% 90%, rgb(var(--color-aurora-via) / 0.14) 0%, transparent 70%)",
        "paper-grain":
          "radial-gradient(circle at 1px 1px, rgb(var(--color-ink-9) / 0.035) 1px, transparent 0)",
      },
      transitionTimingFunction: {
        editorial: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
      keyframes: {
        "aurora-sweep": {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
        "fade-rise": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "aurora-chip-sweep": {
          "0%":   { backgroundPosition: "-120% 0%" },
          "100%": { backgroundPosition: "220% 0%" },
        },
        "progress-grow": {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
      },
      animation: {
        "aurora-sweep": "aurora-sweep 6s linear infinite",
        "fade-rise": "fade-rise 420ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
        "aurora-chip-sweep": "aurora-chip-sweep 2.2s cubic-bezier(0.2, 0.8, 0.2, 1) 1",
      },
    },
  },
  plugins: [typography],
};

export default config;
