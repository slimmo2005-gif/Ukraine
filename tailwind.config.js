/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'ukraine-blue': '#0057B7',
        'ukraine-yellow': '#FFDD00',
        'russian-red': '#B71C1C',
        'osint-dark': '#0f172a',
        'osint-card': '#1e293b',
        'osint-border': '#334155',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
