import type { Config } from "tailwindcss";
const colors = require("tailwindcss/colors");

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Geist", "system-ui", "sans-serif"],
      },
      colors: {
        primary: {
          ...colors.indigo,
        },
        secondary: {
          ...colors.slate,
        },
        success: {
          ...colors.emerald,
        },
        danger: {
          ...colors.red,
        },
        warning: {
          ...colors.amber,
        },
        foreground: colors.slate["950"],
        "muted-foreground": colors.slate["500"],
      },
    },
  },
  plugins: [],
};

export default config;
