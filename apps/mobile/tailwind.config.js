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
        'bg-base': '#0A0A0F',
        'bg-elevated': '#111118',
        'bg-overlay': '#1A1A25',
        gold: '#FFD700',
        'gold-soft': '#E6C200',
        profit: '#00C878',
        loss: '#FF4757',
        warning: '#FF9F43',
        neutral: '#8A8A9A',
      },
      fontFamily: {
        sans: ['Inter_400Regular'],
        medium: ['Inter_500Medium'],
        semibold: ['Inter_600SemiBold'],
        bold: ['Inter_700Bold'],
        extrabold: ['Inter_800ExtraBold'],
      },
      borderRadius: {
        card: '16px',
        'card-lg': '20px',
        'card-xl': '24px',
      },
    },
  },
  plugins: [],
};
