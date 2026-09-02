/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: 'rgb(var(--color-ink-950-rgb) / <alpha-value>)',
          900: 'rgb(var(--color-ink-900-rgb) / <alpha-value>)',
          800: 'rgb(var(--color-ink-800-rgb) / <alpha-value>)',
          700: 'rgb(var(--color-ink-700-rgb) / <alpha-value>)',
        },
        copper: {
          400: 'rgb(var(--color-copper-400-rgb) / <alpha-value>)',
          500: 'rgb(var(--color-copper-500-rgb) / <alpha-value>)',
          600: 'rgb(var(--color-copper-600-rgb) / <alpha-value>)',
          700: 'rgb(var(--color-copper-700-rgb) / <alpha-value>)',
        },
        mist: {
          50: 'rgb(var(--color-mist-50-rgb) / <alpha-value>)',
          100: 'rgb(var(--color-mist-100-rgb) / <alpha-value>)',
          200: 'rgb(var(--color-mist-200-rgb) / <alpha-value>)',
        },
        sea: {
          400: 'rgb(var(--color-sea-400-rgb) / <alpha-value>)',
          500: 'rgb(var(--color-sea-500-rgb) / <alpha-value>)',
          600: 'rgb(var(--color-sea-600-rgb) / <alpha-value>)',
        },
        surface: 'rgb(var(--color-surface-rgb) / <alpha-value>)',
      },
      fontFamily: {
        display: ['"Vazirmatn"', '"IBM Plex Sans Arabic"', 'Tahoma', 'sans-serif'],
        body: ['"Vazirmatn"', 'Tahoma', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 18px 40px rgba(15, 23, 42, 0.12)',
      },
      backgroundImage: {
        'hero-grid': 'var(--hero-grid)',
        'hero-mesh': 'var(--hero-mesh)',
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(22px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        floaty: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        orb: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(12px, -18px) scale(1.06)' },
        },
        'orb-slow': {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '50%': { transform: 'translate(-16px, 10px)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '0.35' },
          '50%': { opacity: '0.7' },
        },
        'bounce-soft': {
          '0%, 100%': { transform: 'translate(-50%, 0)' },
          '50%': { transform: 'translate(-50%, 6px)' },
        },
      },
      animation: {
        rise: 'rise 0.85s cubic-bezier(0.22, 1, 0.36, 1) both',
        floaty: 'floaty 6s ease-in-out infinite',
        shimmer: 'shimmer 2.4s linear infinite',
        orb: 'orb 9s ease-in-out infinite',
        'orb-slow': 'orb-slow 12s ease-in-out infinite',
        'pulse-soft': 'pulse-soft 4s ease-in-out infinite',
        'bounce-soft': 'bounce-soft 2.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
