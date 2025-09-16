/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#dbeaff',
          200: '#b3d4ff',
          300: '#80b6ff',
          400: '#4d95ff',
          500: '#1d6dff',
          600: '#0a54db',
          700: '#083fab',
          800: '#0a3588',
          900: '#0d2f6f',
        },
      },
    },
  },
  plugins: [],
}
