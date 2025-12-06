import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        orb: {
          core: '#00D4E8',
          deep: '#0A1628',
          halo: '#7EE8FA',
        },
        surface: {
          lavender: '#E8D5F0',
          rose: '#F5D0E0',
          cream: '#FFF8F0',
        },
        glass: {
          white: 'rgba(255, 255, 255, 0.75)',
          border: 'rgba(255, 255, 255, 0.4)',
        },
        accent: {
          pink: '#FF8FAB',
          purple: '#C490E4',
          orange: '#FFB366',
          blue: '#7EB8FF',
        },
        text: {
          primary: '#1A1A2E',
          secondary: '#6B6B8D',
          muted: '#9B9BB0',
        },
        voice: {
          active: '#00E5CC',
        },
        success: '#7ED9A6',
        error: '#FF7B7B',
      },
      fontFamily: {
        display: ['Outfit', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        'glass': '24px',
        'card': '16px',
        'button': '12px',
      },
      backdropBlur: {
        glass: '20px',
        'glass-light': '12px',
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(31, 38, 135, 0.12)',
        'glass-lg': '0 16px 48px rgba(31, 38, 135, 0.18)',
        'glow-cyan': '0 0 40px rgba(0, 212, 232, 0.4)',
        'glow-soft': '0 0 60px rgba(126, 232, 250, 0.3)',
        'inset-top': 'inset 0 1px 0 rgba(255, 255, 255, 0.6)',
      },
      animation: {
        'orb-breathe': 'orbBreathe 4s ease-in-out infinite',
        'orb-pulse': 'orbPulse 1.5s ease-in-out infinite',
        'orb-spin': 'orbSpin 2s linear infinite',
        'ring-expand': 'ringExpand 2s ease-out infinite',
        'ambient-shift': 'ambientShift 20s ease infinite',
      },
      keyframes: {
        orbBreathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.9' },
          '50%': { transform: 'scale(1.02)', opacity: '1' },
        },
        orbPulse: {
          '0%, 100%': { boxShadow: '0 0 40px rgba(0, 212, 232, 0.4)' },
          '50%': { boxShadow: '0 0 80px rgba(0, 212, 232, 0.7)' },
        },
        orbSpin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        ringExpand: {
          '0%': { transform: 'scale(0.8)', opacity: '0.8' },
          '100%': { transform: 'scale(1.5)', opacity: '0' },
        },
        ambientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
}

export default config
