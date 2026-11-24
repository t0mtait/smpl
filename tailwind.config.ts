import type { Config } from "tailwindcss";

/**
 * Every colour in the app is a CSS custom property, not a literal.
 *
 * The variables are declared in app/globals.css as plain "R G B" triplets
 * so Tailwind's opacity modifiers (`bg-shell/90`, `ring-accent/10`) keep
 * working. The light values live on `:root`; the dark values live on
 * `.dark`, which the theme toggle puts on <html>.
 *
 * That means a component never says `dark:bg-something`. It says
 * `bg-card` or `text-muted` once, and the palette underneath it changes.
 */
const v = (token: string) => `rgb(var(--c-${token}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /* Surfaces — the warm paper neutrals the whole app sits on. */
        paper: v("paper"),
        card: v("card"),
        shell: v("shell"),
        wash: v("wash"),
        line: v("line"),
        "line-soft": v("line-soft"),
        "line-strong": v("line-strong"),

        /* Content */
        ink: v("ink"),
        "ink-soft": v("ink-soft"),
        "ink-faint": v("ink-faint"),
        muted: v("muted"),

        /* Brand — the inverted block used for the mark, the primary
           button and the active navigation item. */
        brand: v("brand"),
        "brand-fg": v("brand-fg"),
        "brand-hover": v("brand-hover"),
        /* The moss tick that sits on top of a brand block. */
        "brand-mark": v("brand-mark"),

        /* Moss — the accent that says "kept" and "recommended". */
        accent: v("accent"),
        "accent-soft": v("accent-soft"),
        "accent-solid": v("accent-solid"),
        "accent-fg": v("accent-fg"),
        "accent-hover": v("accent-hover"),
        /* The moss tone used for data marks — bars, dots, chart series. */
        "accent-mark": v("accent-mark"),

        /* Terracotta — the warm signal used for disposals and warnings. */
        clay: v("clay"),
        "clay-soft": v("clay-soft"),
        "clay-solid": v("clay-solid"),
        "clay-fg": v("clay-fg"),
        "clay-hover": v("clay-hover"),
        "clay-mark": v("clay-mark"),
        "clay-line": v("clay-line"),

        /* Status colours */
        info: v("info"),
        "info-soft": v("info-soft"),
        warn: v("warn"),
        "warn-soft": v("warn-soft"),
        "warn-mark": v("warn-mark"),
        danger: v("danger"),
        "danger-soft": v("danger-soft"),
        "danger-line": v("danger-line"),
        "danger-line-strong": v("danger-line-strong"),

        /* Data ink */
        "chart-ink": v("chart-ink"),
      },
      fontFamily: {
        sans: [
          "var(--font-lora)",
          "ui-serif",
          "Georgia",
          "Cambria",
          "serif",
        ],
        display: [
          "var(--font-lora)",
          "ui-serif",
          "Georgia",
          "Cambria",
          "serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgb(var(--c-shadow) / 0.04), 0 1px 1px rgb(var(--c-shadow) / 0.03)",
        lift: "0 4px 16px rgb(var(--c-shadow) / 0.07), 0 1px 2px rgb(var(--c-shadow) / 0.04)",
      },
      keyframes: {
        rise: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "none" },
        },
        fade: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        rise: "rise 0.4s cubic-bezier(0.22, 1, 0.36, 1) both",
        fade: "fade 0.3s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
