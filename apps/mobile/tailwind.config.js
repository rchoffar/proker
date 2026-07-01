/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        accent: '#0E9E62',
        'accent-bright': '#17E58A',
        loss: '#E5484D',
        ink: {
          DEFAULT: '#23252B',
          2: '#5A5E68',
          3: '#8A8F99',
        },
        glass: {
          light: 'rgba(255, 255, 255, 0.55)',
          border: 'rgba(255, 255, 255, 0.70)',
          dark: '#181A1D',
          field: 'rgba(255, 255, 255, 0.60)',
        },
      },
      fontFamily: {
        display: ['Jost_300Light'],
        sans: ['Geist_400Regular'],
        medium: ['Geist_500Medium'],
        semibold: ['Geist_600SemiBold'],
        bold: ['Geist_700Bold'],
        extrabold: ['Geist_800ExtraBold'],
      },
      borderRadius: {
        field: '16px',
        card: '22px',
        hero: '26px',
        sheet: '34px',
      },
    },
  },
  plugins: [],
};
