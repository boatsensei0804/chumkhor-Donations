/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        thai: ['"Prompt"', '"Sarabun"', 'sans-serif'],
        display: ['"Kanit"', '"Prompt"', 'sans-serif'],
      },
      colors: {
        ceremony: {
          gold: '#f59e0b',
          goldLight: '#fef08a',
          goldDark: '#b45309',
          blue: '#1e40af',
          sky: '#38bdf8',
          deepSky: '#0284c7'
        }
      },
      boxShadow: {
        'glow-gold': '0 0 25px rgba(245, 158, 11, 0.45)',
        'glow-blue': '0 0 30px rgba(56, 189, 248, 0.35)',
      },
      animation: {
        'popup-in': 'popupIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'popup-out': 'popupOut 0.4s cubic-bezier(0.7, 0, 0.84, 0) forwards',
        'pulse-subtle': 'pulseSubtle 3s infinite ease-in-out',
        'shimmer': 'shimmer 2.5s infinite linear',
      },
      keyframes: {
        popupIn: {
          '0%': { opacity: '0', transform: 'scale(0.85) translateY(20px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        popupOut: {
          '0%': { opacity: '1', transform: 'scale(1) translateY(0)' },
          '100%': { opacity: '0', transform: 'scale(0.9) translateY(-20px)' },
        },
        pulseSubtle: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.02)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        }
      }
    },
  },
  plugins: [],
}
