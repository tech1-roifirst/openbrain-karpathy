import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        // Project palette — kept here so designers can tune in one place.
        brand: {
          DEFAULT: '#3B82F6', // blue-500
          dark: '#2563EB',    // blue-600
        },
        accent: {
          DEFAULT: '#10B981', // emerald-500
        },
      },
    },
  },
  plugins: [],
};

export default config;
