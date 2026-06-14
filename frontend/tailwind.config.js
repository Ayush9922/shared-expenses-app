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
          50: '#f5f7ff',
          100: '#ebf0ff',
          200: '#d6e0ff',
          300: '#b3c7ff',
          400: '#85a3ff',
          500: '#5275ff',
          600: '#2e4cff',
          700: '#1a32eb',
          800: '#1225c2',
          900: '#162399',
        },
        dark: {
          50: '#f6f6f7',
          100: '#eef0f2',
          200: '#dadfe5',
          300: '#b8c3d0',
          400: '#8fa2b8',
          500: '#6f859f',
          600: '#576c86',
          700: '#46566c',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
