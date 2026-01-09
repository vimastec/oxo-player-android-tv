/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'oxo-red': '#E50914',
        'oxo-dark': '#0a0a0a',
        'oxo-gray': '#1a1a1a',
      },
      fontFamily: {
        sans: ['Samsung One', 'Roboto', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

