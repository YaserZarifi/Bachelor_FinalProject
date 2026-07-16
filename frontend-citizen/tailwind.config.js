/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Persian + body
        sans: ['Vazirmatn', 'system-ui', 'sans-serif'],
        // Latin display + numerals render in Space Grotesk; Persian falls back to Vazirmatn
        display: ['"Space Grotesk"', 'Vazirmatn', 'system-ui', 'sans-serif'],
        mono: ['"Space Grotesk"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // ── Ink: the civic night canvas ──────────────────────────────
        ink: {
          950: '#060a14',
          900: '#0b1220',
          850: '#101a2e',
          800: '#15213a',
          700: '#1d2b49',
          600: '#273a5f',
          DEFAULT: '#0b1220',
        },
        // ── Beacon (amber): the "signal / attention" — primary accent ──
        beacon: {
          50: '#fff8ea',
          100: '#fdecc4',
          200: '#fbdd97',
          300: '#f9c95a',
          400: '#f9b526',
          500: '#f2a20d',
          600: '#d67f04',
          700: '#b15c08',
          800: '#8f480e',
          900: '#763b0f',
          950: '#451e05',
        },
        // ── Civic (emerald): service / resolved / live / success ──────
        civic: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#0d9c6e',
          700: '#0f7a58',
          800: '#115e45',
          900: '#124a38',
          950: '#042f21',
        },
        // ── Coral: urgent / crisis / emergency ────────────────────────
        coral: {
          50: '#fff1f2',
          100: '#ffe0e3',
          200: '#fdc9cf',
          300: '#fba3ae',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
          800: '#9f1239',
          900: '#881337',
          950: '#4c0519',
        },
        // ── Sky: info / in-progress ───────────────────────────────────
        sky: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
      },
      borderRadius: {
        '2xl': '1.1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,0.06), 0 12px 28px -16px rgba(15,23,42,0.22)',
        'card-dark':
          'inset 0 1px 0 0 rgba(255,255,255,0.05), 0 24px 60px -28px rgba(0,0,0,0.8)',
        lift: '0 18px 44px -18px rgba(15,23,42,0.32)',
        signal: '0 10px 30px -10px rgba(242,162,13,0.55)',
        'signal-lg': '0 22px 55px -14px rgba(242,162,13,0.6)',
        civic: '0 12px 34px -12px rgba(16,185,129,0.5)',
        coral: '0 12px 34px -12px rgba(244,63,94,0.5)',
      },
      keyframes: {
        'signal-ping': {
          '0%': { transform: 'scale(0.6)', opacity: '0.65' },
          '80%, 100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        'beacon-pulse': {
          '0%, 100%': { transform: 'translateY(0)', filter: 'brightness(1)' },
          '50%': { transform: 'translateY(-2px)', filter: 'brightness(1.15)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'grid-pan': {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '48px 48px' },
        },
      },
      animation: {
        'signal-ping': 'signal-ping 2.4s cubic-bezier(0,0,0.2,1) infinite',
        'beacon-pulse': 'beacon-pulse 3s ease-in-out infinite',
        float: 'float 7s ease-in-out infinite',
        'fade-up': 'fade-up 0.6s cubic-bezier(0.22,1,0.36,1) both',
        'grid-pan': 'grid-pan 24s linear infinite',
      },
      backgroundImage: {
        'signal-text':
          'linear-gradient(100deg,#fbbf24 0%,#f2a20d 55%,#d67f04 100%)',
        'civic-text':
          'linear-gradient(100deg,#6ee7b7 0%,#10b981 60%,#0d9c6e 100%)',
      },
    },
  },
  plugins: [],
}
