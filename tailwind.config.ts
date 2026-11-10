import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
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
        },
        moss: {
          400: "#8fb98a",
          500: "#6fa168",
          600: "#578150",
          700: "#466640",
        },
        clay: {
          400: "#d99a7a",
          500: "#c67f5c",
          600: "#a96647",
        },
      },
    },
  },
  plugins: [],
};

export default config;
