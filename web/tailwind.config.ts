import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-dm-sans)", "system-ui", "-apple-system", "sans-serif"],
        display: ["var(--font-outfit)", "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        // Brand tokens
        brand: {
          lime: "#E4FF1A",
          "lime-dark": "#c8e600",
          dark: "#060606",
          light: "#f5f5ef",
        },
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
        // Neon lime — brand accent
        primary: {
          50: "#fdfff0",
          100: "#f8ffe0",
          200: "#f0ffa8",
          300: "#e8ff70",
          400: "#E4FF1A",
          500: "#c8e600",
          600: "#a3b800",
          700: "#7a8a00",
          800: "#525c00",
          900: "#292e00",
          950: "#141700",
        },
        // Semantic colors — ERPNext surface pairs
        success: {
          50: "#f4fff0",
          100: "#e4f5e0",
          200: "#c8ebc0",
          300: "#8fd884",
          400: "#4ec244",
          500: "#28a745",
          600: "#1e8438",
          700: "#166b2b",
          800: "#0f4f1e",
          900: "#0a3514",
          950: "#051a0a",
        },
        warning: {
          50: "#fff8e1",
          100: "#fff0c2",
          200: "#ffe08a",
          300: "#ffd052",
          400: "#f5be3b",
          500: "#f0ad4e",
          600: "#d99429",
          700: "#b07810",
          800: "#7a5200",
          900: "#4a3200",
          950: "#2a1c00",
        },
        danger: {
          50: "#fff5f5",
          100: "#ffe0e0",
          200: "#ffc0c0",
          300: "#ff9090",
          400: "#f06060",
          500: "#e24c4c",
          600: "#cc3333",
          700: "#a82828",
          800: "#7a1d1d",
          900: "#4a1212",
          950: "#2a0a0a",
        },
        info: {
          50: "#eff8ff",
          100: "#dbeefe",
          200: "#b8ddfe",
          300: "#7ec4fd",
          400: "#40a9fc",
          500: "#0289f7",
          600: "#0070d6",
          700: "#0059ad",
          800: "#004080",
          900: "#002a55",
          950: "#001830",
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
        "focus": "0 0 0 2px #E4FF1A",
        // Keep backwards compat aliases used in components
        "soft-xs": "0 1px 2px rgba(0, 0, 0, 0.06)",
        "soft-sm": "0 1px 3px rgba(0, 0, 0, 0.08)",
        "soft": "0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)",
        "soft-md": "0 4px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04)",
        "soft-lg": "0 8px 24px rgba(0, 0, 0, 0.12)",
        "soft-xl": "0 16px 48px rgba(0, 0, 0, 0.12)",
        "glow": "0 0 0 2px #E4FF1A",
        "glow-lg": "0 0 0 3px rgba(228, 255, 26, 0.3)",
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
