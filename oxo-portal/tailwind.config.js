/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#dc2626',
        'primary-hover': '#b91c1c',
        dark: {
          100: '#1a1a2e',
          200: '#16162a',
          300: '#0f0f1a',
          400: '#0a0a12',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}









