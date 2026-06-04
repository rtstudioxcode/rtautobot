import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        green: {
          DEFAULT: '#08b84f',
          50: '#e6fdf0',
          100: '#c0f5d6',
          200: '#86ecb2',
          300: '#3ede86',
          400: '#1dcf65',
          500: '#08b84f',
          600: '#06a044',
          700: '#058038',
          800: '#03612a',
          900: '#02411c',
        },
        navy: {
          950: '#03040a',
          900: '#07080b',
          800: '#111218',
          700: '#17181d',
          600: '#1e2028',
          500: '#282b38',
        },
      },
      fontFamily: {
        sans: ['Prompt', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'glow-green': '0 0 24px rgba(7,168,74,0.25)',
        card: '0 4px 24px rgba(0,0,0,0.32)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
