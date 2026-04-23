import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          500: "#e63946",
          600: "#c92a3a",
        },
        surface: {
          0: "#0f0f14",
          1: "#161620",
          2: "#1f1f2d",
        },
        text: {
          primary: "#f4f4f6",
          secondary: "#a6a6b0",
          tertiary: "#6b6b7a",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
