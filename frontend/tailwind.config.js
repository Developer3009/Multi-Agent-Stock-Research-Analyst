/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          900: '#064e3b',
        },
        upward: {
          green: {
            light: '#34d399',
            DEFAULT: '#059669',
            dark: '#047857',
            glow: '#10b981',
          },
          navy: {
            light: '#334155',
            DEFAULT: '#0f172a',
            dark: '#090d14',
            surface: '#141a29',
          },
          card: {
            dark: '#0d121f',
            light: '#ffffff',
          },
          border: {
            dark: '#1e293b',
            light: '#e2e8f0',
          },
        },
        nse: '#059669',
        bse: '#dc2626',
      },
    },
  },
  plugins: [],
}
