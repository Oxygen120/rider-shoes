/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111719",
        paper: "#f5f6f3",
        coral: "#e83c4a",
        mist: "#e7ecea",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "Inter", "ui-sans-serif", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 80px rgba(232,60,74,.22)",
        panel: "0 24px 70px rgba(16,25,28,.12)",
      },
    },
  },
  plugins: [],
};
