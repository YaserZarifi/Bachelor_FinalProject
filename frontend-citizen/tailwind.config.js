/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Vazirmatn', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          600: '#0369a1',
          700: '#075985',
          900: '#0c4a6e',
        },
      },
    },
  },
  plugins: [],
}
