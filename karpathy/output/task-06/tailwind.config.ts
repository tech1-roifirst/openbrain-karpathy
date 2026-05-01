import type { Config } from 'tailwindcss';

/**
 * Task-06 palette mirrors the brief's "Color Palette (Accessible)" exactly so
 * contrast ratios stay above WCAG AA. Tweak in one place if the design changes.
 */
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        ink: '#1F2937',
        border: {
          DEFAULT: '#D1D5DB',
          focus: '#3B82F6',
          error: '#FCA5A5',
        },
        brand: {
          DEFAULT: '#3B82F6',
          dark: '#2563EB',
          disabled: '#D1D5DB',
        },
        danger: {
          text: '#DC2626',
          bg: '#FEF2F2',
          border: '#FCA5A5',
        },
        success: {
          text: '#059669',
          bg: '#F0FDF4',
          check: '#10B981',
        },
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(-4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 180ms ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
