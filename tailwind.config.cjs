/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#050816',
        surface: '#0f172a',
        accent: '#22d3ee'
      }
    }
  },
  plugins: []
};

