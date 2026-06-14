/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Vazirmatn', 'system-ui', 'sans-serif'],
        display: ['Vazirmatn', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Refreshed "Aurora" brand — civic indigo anchor
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        // Aurora accents used for gradient meshes + glows
        aurora: {
          violet: '#8b5cf6',
          cyan: '#06b6d4',
          teal: '#14b8a6',
          fuchsia: '#d946ef',
          sky: '#38bdf8',
        },
        ink: '#070b1a', // dark canvas
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        glass:
          '0 8px 32px -8px rgba(15,23,42,0.18), inset 0 1px 0 0 rgba(255,255,255,0.45)',
        'glass-dark':
          '0 18px 50px -18px rgba(0,0,0,0.7), inset 0 1px 0 0 rgba(255,255,255,0.06)',
        glow: '0 10px 30px -10px rgba(99,102,241,0.55)',
        'glow-lg': '0 24px 60px -14px rgba(99,102,241,0.65)',
        'glow-emerald': '0 14px 40px -12px rgba(16,185,129,0.55)',
      },
      keyframes: {
        blob: {
          '0%, 100%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -40px) scale(1.12)' },
          '66%': { transform: 'translate(-24px, 22px) scale(0.92)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '70%, 100%': { transform: 'scale(2.2)', opacity: '0' },
        },
      },
      animation: {
        blob: 'blob 20s ease-in-out infinite',
        'blob-slow': 'blob 28s ease-in-out infinite',
        float: 'float 6s ease-in-out infinite',
        shimmer: 'shimmer 2.4s linear infinite',
        'fade-up': 'fade-up 0.6s ease-out both',
        'pulse-ring': 'pulse-ring 2.4s cubic-bezier(0.4,0,0.2,1) infinite',
      },
      backgroundImage: {
        'aurora-text':
          'linear-gradient(120deg, #818cf8 0%, #22d3ee 45%, #34d399 100%)',
      },
    },
  },
  plugins: [],
}
