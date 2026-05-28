import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1b2554",
        sand: "#f4f7ff",
        signal: "#4f7ed9",
        moss: "#6b7fb0",
      },
    },
  },
  plugins: [],
};

export default config;
