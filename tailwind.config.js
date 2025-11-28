/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#faf8f6',
          100: '#f5f1ed',
          200: '#ede5dd',
          300: '#e8d4c0',
          400: '#d4aa7a',
          500: '#c9956d',
          600: '#b8845a',
          700: '#a08c6b',
          800: '#8b7660',
          900: '#6b5d52',
        },
      },
    },
  },
  plugins: [],
}
