import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

// Colors are CSS variables (RGB channels) defined in app/globals.css so
// opacity modifiers like bg-primary/15 keep working.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Deep green surface scale built on #1a3d2e (named `pitch` so the
        // stock Tailwind `green-*` used by older pages is untouched).
        pitch: {
          950: v("green-950"),
          900: v("green-900"),
          850: v("green-850"),
          800: v("green-800"),
          700: v("green-700"),
          600: v("green-600"),
        },
        background: v("background"),
        foreground: v("foreground"),
        card: { DEFAULT: v("card"), foreground: v("foreground") },
        popover: { DEFAULT: v("popover"), foreground: v("foreground") },
        secondary: { DEFAULT: v("secondary"), foreground: v("foreground") },
        muted: { DEFAULT: v("secondary"), foreground: v("muted-foreground") },
        subtle: v("subtle"),
        accent: { DEFAULT: v("brand"), foreground: v("foreground") },
        brand: v("brand"),
        primary: {
          DEFAULT: v("primary"),
          hover: v("primary-hover"),
          pressed: v("primary-pressed"),
          foreground: v("primary-foreground"),
          text: v("primary-text"),
        },
        destructive: { DEFAULT: v("destructive"), foreground: v("primary-foreground") },
        success: { DEFAULT: v("success"), solid: v("success-solid") },
        lime: v("lime"),
        live: v("primary"),
        skill: {
          unranked: v("skill-unranked"),
          "unranked-bg": v("skill-unranked-bg"),
          beginner: v("skill-beginner"),
          intermediate: v("skill-intermediate"),
          advanced: v("skill-advanced"),
          ink: v("skill-ink"),
        },
        format: {
          americano: v("format-americano"),
          team: v("format-team"),
        },
        medal: {
          gold: v("medal-gold"),
          silver: v("medal-silver"),
          bronze: v("medal-bronze"),
        },
        border: "rgb(255 255 255 / 0.08)",
        "border-strong": "rgb(255 255 255 / 0.14)",
        input: "rgb(255 255 255 / 0.14)",
        ring: v("primary-text"),
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
      },
      fontSize: {
        overline: ["0.75rem", { lineHeight: "1rem", letterSpacing: "0.18em" }],
        hero: ["2.5rem", { lineHeight: "0.95", letterSpacing: "-0.01em" }],
        "hero-lg": ["3.5rem", { lineHeight: "0.95", letterSpacing: "-0.01em" }],
        score: ["3rem", { lineHeight: "1" }],
        rating: ["3.5rem", { lineHeight: "1" }],
      },
      boxShadow: {
        card: "inset 0 1px 0 rgb(255 255 255 / 0.04)",
        elevated: "0 16px 40px -12px rgb(0 0 0 / 0.6)",
        cta: "0 8px 24px -8px rgb(255 107 53 / 0.55)",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(.22,1,.36,1)",
      },
      keyframes: {
        "live-pulse": {
          "0%": { transform: "scale(1)", opacity: "0.7" },
          "70%, 100%": { transform: "scale(2.4)", opacity: "0" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "live-pulse": "live-pulse 1.6s cubic-bezier(.22,1,.36,1) infinite",
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [animate],
};
export default config;
