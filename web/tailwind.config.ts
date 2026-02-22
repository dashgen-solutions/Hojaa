import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        // ERPNext gray scale
        neutral: {
          50: "#f8f8f8",
          100: "#f3f3f3",
          200: "#e2e2e2",
          300: "#c7c7c7",
          400: "#a3a3a3",
          500: "#7c7c7c",
          600: "#525252",
          700: "#404040",
          800: "#262626",
          900: "#171717",
          950: "#0a0a0a",
        },
        // Blue — links, focus rings, interactive only
        primary: {
          50: "#eff8ff",
          100: "#dbeefe",
          200: "#bfe0fe",
          300: "#93cdfd",
          400: "#3fabfa",
          500: "#0289f7",
          600: "#0070d6",
          700: "#0059ad",
          800: "#004b8f",
          900: "#003f76",
          950: "#002850",
        },
        // Semantic colors — ERPNext surface pairs
        success: {
          50: "#f4fff0",
          100: "#e4f5e0",
          500: "#28a745",
          600: "#1e8438",
          700: "#166b2b",
        },
        warning: {
          50: "#fff8e1",
          100: "#fff0c2",
          500: "#f0ad4e",
          600: "#d99429",
          700: "#b07810",
        },
        danger: {
          50: "#fff5f5",
          100: "#ffe0e0",
          500: "#e24c4c",
          600: "#cc3333",
          700: "#a82828",
        },
        info: {
          50: "#eff8ff",
          100: "#dbeefe",
          500: "#0289f7",
          600: "#0070d6",
          700: "#0059ad",
        },
      },
      boxShadow: {
        "xs": "0 1px 2px rgba(0, 0, 0, 0.06)",
        "sm": "0 1px 3px rgba(0, 0, 0, 0.08)",
        "DEFAULT": "0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)",
        "md": "0 4px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04)",
        "lg": "0 8px 24px rgba(0, 0, 0, 0.12)",
        "xl": "0 16px 48px rgba(0, 0, 0, 0.12)",
        "dropdown": "0 2px 8px rgba(0, 0, 0, 0.12), 0 0 1px rgba(0, 0, 0, 0.08)",
        "modal": "0 8px 32px rgba(0, 0, 0, 0.16)",
        "focus": "0 0 0 2px #0289f7",
        // Keep backwards compat aliases used in components
        "soft-xs": "0 1px 2px rgba(0, 0, 0, 0.06)",
        "soft-sm": "0 1px 3px rgba(0, 0, 0, 0.08)",
        "soft": "0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)",
        "soft-md": "0 4px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04)",
        "soft-lg": "0 8px 24px rgba(0, 0, 0, 0.12)",
        "soft-xl": "0 16px 48px rgba(0, 0, 0, 0.12)",
        "glow": "0 0 0 2px #0289f7",
        "glow-lg": "0 0 0 3px rgba(2, 137, 247, 0.3)",
        "inner-soft": "inset 0 1px 2px rgba(0, 0, 0, 0.06)",
      },
      borderRadius: {
        "sm": "4px",
        "DEFAULT": "6px",
        "md": "8px",
        "lg": "12px",
        "xl": "16px",
      },
      spacing: {
        "4.5": "18px",
        "7": "28px",
        "7.5": "30px",
      },
      fontSize: {
        "2xs": ["11px", { lineHeight: "16px" }],
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "fade-in-up": "fadeInUp 0.3s ease-out",
        "fade-in-down": "fadeInDown 0.2s ease-out",
        "scale-in": "scaleIn 0.15s ease-out",
        "slide-in-right": "slideInRight 0.2s ease-out",
        "slide-in-left": "slideInLeft 0.2s ease-out",
        "pulse-soft": "pulseSoft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "shimmer": "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeInDown: {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        slideInLeft: {
          "0%": { opacity: "0", transform: "translateX(-16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      transitionTimingFunction: {
        "smooth": "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
