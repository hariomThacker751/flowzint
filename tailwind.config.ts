import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./store/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        void: "#05060a",
        ink: "#0b0f17",
        panel: "rgba(12, 17, 27, 0.72)",
        line: "rgba(255, 255, 255, 0.1)",
        cyan: "#55e6ff",
        violet: "#8b5cf6",
        signal: "#38ef7d",
      },
      boxShadow: {
        glow: "0 0 36px rgba(85, 230, 255, 0.18)",
        violet: "0 0 34px rgba(139, 92, 246, 0.2)",
      },
      animation: {
        "slow-pan": "slow-pan 14s ease-in-out infinite alternate",
        "pulse-ring": "pulse-ring 2.4s ease-out infinite",
        "scan": "scan 3.6s linear infinite",
      },
      keyframes: {
        "slow-pan": {
          "0%": { transform: "translate3d(-2%, -1%, 0) scale(1)" },
          "100%": { transform: "translate3d(2%, 1%, 0) scale(1.04)" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(56, 239, 125, 0.42)" },
          "75%": { boxShadow: "0 0 0 10px rgba(56, 239, 125, 0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(56, 239, 125, 0)" },
        },
        scan: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
