import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // FARO base — deep navy, never absolute black
        base: {
          DEFAULT: '#0B1120',
          900: '#0B1120',
          800: '#101935',
          700: '#16203F',
          600: '#1D2A4D',
        },
        // Semantic operational palette
        critical: {
          DEFAULT: '#FF453A',
          soft: 'rgba(255, 69, 58, 0.14)',
          ring: 'rgba(255, 69, 58, 0.30)',
        },
        warning: {
          DEFAULT: '#FFD60A',
          soft: 'rgba(255, 214, 10, 0.14)',
          ring: 'rgba(255, 214, 10, 0.28)',
        },
        operational: {
          DEFAULT: '#30D158',
          soft: 'rgba(48, 209, 88, 0.14)',
          ring: 'rgba(48, 209, 88, 0.28)',
        },
        info: {
          DEFAULT: '#0A84FF',
          soft: 'rgba(10, 132, 255, 0.14)',
          ring: 'rgba(10, 132, 255, 0.28)',
        },
        // Neutral text scale
        ink: {
          DEFAULT: '#F5F7FF',
          muted: '#9AA4BF',
          subtle: '#6B7693',
          faint: '#454F6B',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Display',
          'SF Pro Text',
          'Inter',
          'system-ui',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0, 0, 0, 0.35)',
        'glass-sm': '0 2px 12px rgba(0, 0, 0, 0.25)',
        focal: '0 12px 40px rgba(10, 132, 255, 0.35)',
      },
      transitionTimingFunction: {
        'apple': 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.95)', opacity: '0.7' },
          '70%': { transform: 'scale(1.6)', opacity: '0' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 2.4s cubic-bezier(0.32, 0.72, 0, 1) infinite',
        'fade-up': 'fade-up 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
      },
    },
  },
  plugins: [],
}

export default config
