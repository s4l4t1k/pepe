/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        poker: {
          bg: '#0a0f0a',
          card: '#111a11',
          primary: '#c8a84b',
          'primary-dark': '#a88a35',
          secondary: '#1a3a1a',
          accent: '#2d5a2d',
          text: '#e8e8e8',
          'text-muted': '#8a9a8a',
          danger: '#c0392b',
          success: '#27ae60',
          border: '#2a3a2a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-gold': 'pulseGold 2s infinite',
        'card-flip': 'cardFlip 0.6s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(200, 168, 75, 0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgba(200, 168, 75, 0)' },
        },
        cardFlip: {
          '0%': { transform: 'rotateY(0deg)' },
          '100%': { transform: 'rotateY(360deg)' },
        },
      },
      backgroundImage: {
        'felt': "radial-gradient(ellipse at center, #1a3a1a 0%, #0a0f0a 100%)",
        'card-gradient': 'linear-gradient(135deg, #1a2a1a 0%, #111a11 100%)',
        'gold-gradient': 'linear-gradient(135deg, #c8a84b 0%, #a88a35 100%)',
      },
    },
  },
  plugins: [],
}
