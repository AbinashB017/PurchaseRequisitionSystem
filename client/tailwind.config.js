/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef3ef',
          100: '#d7e2d9',
          500: '#357c5a',
          600: '#1F4D3A', // Deep Forest Green (Primary)
          700: '#173c2d',
          800: '#11291e',
          900: '#0a1711',
        },
        surface: {
          50: '#FAFAF7', // Warm off-white background
          100: '#f4f4f0',
          200: '#E5E5DF', // Muted warm gray borders
          300: '#d1d1c8',
          400: '#b0b0a5',
          500: '#8C8C85',
          600: '#696963',
          700: '#4b4b47',
          800: '#2e2e2a',
          900: '#1A1D23', // Near-black ink text
          950: '#0f1114',
        },
        status: {
          draft: '#737368',
          submitted: '#9B761E',
          approved: '#1F4D3A',
          ordered: '#705969',
          received: '#4A6B53',
          rejected: '#8C3B3B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Newsreader', 'Georgia', 'serif'],
      },
      boxShadow: {
        'soft': '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
      },
    },
  },
  plugins: [],
}
