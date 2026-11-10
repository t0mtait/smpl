import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Warm paper neutrals — the whole app sits on these.
        paper: "#f7f6f3",
        card: "#ffffff",
        line: "#e6e3dc",
        muted: "#726f65",
        ink: {
          50: "#f6f6f4",
          100: "#e9e9e4",
          200: "#d5d5cd",
          300: "#b3b3a8",
          400: "#8d8d80",
          500: "#6f6f63",
          600: "#585850",
          700: "#474740",
          800: "#3b3b36",
          900: "#33332f",
          950: "#1b1b19",
          DEFAULT: "#22211d",
        },
        moss: {
          50: "#f0f5ee",
          100: "#dce9d8",
          200: "#bcd4b6",
          300: "#8fb98a",
          400: "#6fa168",
          500: "#578150",
          600: "#466640",
          700: "#3a5235",
          DEFAULT: "#466640",
        },
        clay: {
          50: "#fbf0ea",
          100: "#f5ded0",
          200: "#e9bda4",
          300: "#d99a7a",
          400: "#c67f5c",
          500: "#9a5b3f",
          600: "#8c5039",
          DEFAULT: "#9a5b3f",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-serif)", "ui-serif", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(34, 33, 29, 0.04), 0 1px 1px rgba(34, 33, 29, 0.03)",
        lift: "0 4px 16px rgba(34, 33, 29, 0.07), 0 1px 2px rgba(34, 33, 29, 0.04)",
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
