/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'sans-serif'],
      },
      borderRadius: {
        'btn': 'var(--btn-radius, 10px)',
      },
      colors: {
        gold: {
          DEFAULT: '#b8860b',
          dim: 'rgba(184, 134, 11, 0.08)',
        },
      },
    },
  },
  plugins: [],
}
