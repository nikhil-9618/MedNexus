import colors from 'tailwindcss/colors';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Accessible neutral ramp. slate-500 is darkened from Tailwind's
        // #64748b to #5b6b7f so that secondary text clears WCAG AA (4.5:1) on
        // every light surface this design system uses:
        //   white 5.45 · slate-50 5.21 · slate-100 4.97 · brand-50 5.09
        // slate-400 stays decorative-only (never body copy on light surfaces).
        slate: { ...colors.slate, 500: '#5b6b7f' },
        brand: {
          50: '#eff9fb',
          100: '#d7eff5',
          200: '#b0e0ec',
          300: '#7bc9de',
          400: '#43abc9',
          500: '#2590af',
          600: '#1d7391',
          700: '#1c5d76',
          800: '#1c4d60',
          900: '#1b4051',
          950: '#0c2a38',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Sora', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,42,67,.06), 0 8px 24px -12px rgba(16,42,67,.12)',
        pop: '0 12px 40px -12px rgba(16,42,67,.25)',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeUp: 'fadeUp .3s ease-out both',
      },
    },
  },
  plugins: [],
};
