import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        emerald: {
          DEFAULT: "#0a4f3f",
          dark: "#083a2e",
          light: "#0d6650",
          // Tint ladder for hovers, selected rows, and soft fills.
          50: "#eef4f1",
          100: "#dcebe4",
          200: "#b9d6ca",
        },
        gold: {
          DEFAULT: "#a87f2f",
          // Passes WCAG AA for small text on white/cream; use for gold text.
          dark: "#7c5c1f",
          light: "#c79a45",
          // Soft fills behind "money-in" / achievement moments.
          50: "#faf3e2",
          100: "#f3e5c2",
        },
        cream: "#faf6ec",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
