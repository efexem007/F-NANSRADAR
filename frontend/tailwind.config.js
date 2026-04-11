/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0a0e1a',
        'bg-card': '#111827',
        'bg-card-hover': '#1a2236',
        'bg-sidebar': '#0d1224',
        'bg-header': '#0f1629',
        'border': 'rgba(255, 255, 255, 0.06)',
        'border-hover': 'rgba(255, 255, 255, 0.12)',
        'accent': '#00d4ff',
        'green': '#22c55e',
        'red': '#ef4444',
        'yellow': '#f59e0b',
        'purple': '#a855f7',
        'pink': '#ec4899',
        'text-primary': '#f1f5f9',
        'text-secondary': '#94a3b8',
        'text-muted': '#64748b',
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
