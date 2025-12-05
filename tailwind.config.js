/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm ParentVillage brand palette
        brand: {
          50: '#fdfbf7',
          100: '#faf5ed',
          200: '#f5ebe0',
          300: '#e8d4b8',
          400: '#d4a373',
          500: '#c9895a',
          600: '#b87333',
          700: '#9c6644',
          800: '#7f5539',
          900: '#5c3d2e',
        },
        // Warm cream backgrounds
        cream: {
          50: '#fefdfb',
          100: '#fdf8f0',
          200: '#f9f1e4',
          300: '#f5e6d3',
          400: '#e8d4b8',
        },
        // Accent colors with full scales
        terracotta: {
          50: '#fef6f3',
          100: '#fde8e0',
          200: '#fbd4c5',
          300: '#e09f7d',
          400: '#d4845a',
          500: '#c76b40',
          600: '#b85a30',
          700: '#9a4a28',
          800: '#7d3d22',
        },
        sage: {
          50: '#f6f9f4',
          100: '#e8f0e4',
          200: '#d4e3cc',
          300: '#b5c7a3',
          400: '#9ab488',
          500: '#7d9a6b',
          600: '#5f7a4d',
          700: '#4d6340',
          800: '#3f5135',
        },
        mustard: {
          50: '#fefcf3',
          100: '#fdf6e0',
          200: '#faedc7',
          300: '#f5d89a',
          400: '#e8c860',
          500: '#d4a72c',
          600: '#b89024',
          700: '#96751d',
          800: '#785d18',
        },
        coral: {
          50: '#fef5f3',
          100: '#fde6e1',
          200: '#fbd0c7',
          300: '#f4a89a',
          400: '#e8907e',
          500: '#d9735c',
          600: '#c45a43',
          700: '#a34836',
          800: '#863c2e',
        },
      },
      fontFamily: {
        sans: ['Avenir', 'Avenir Next', 'Segoe UI', 'system-ui', 'sans-serif'],
        display: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
      },
      boxShadow: {
        'warm': '0 4px 14px 0 rgba(156, 102, 68, 0.1)',
        'warm-lg': '0 10px 40px -10px rgba(156, 102, 68, 0.2)',
        'glow': '0 0 20px rgba(212, 163, 115, 0.3)',
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'bounce-slow': 'bounce 2s ease-in-out infinite',
        'wiggle': 'wiggle 1s ease-in-out infinite',
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
    },
  },
  plugins: [],
}
