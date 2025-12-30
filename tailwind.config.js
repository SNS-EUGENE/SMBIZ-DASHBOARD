/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary - Raycast Red
        primary: {
          DEFAULT: '#FF6363',
          hover: '#FF4D4D',
          light: 'rgba(255, 99, 99, 0.1)',
          dark: '#CC4F4F',
        },
        // Background
        bg: {
          primary: '#0D0D0D',
          secondary: '#1A1A1A',
          tertiary: '#242424',
          elevated: '#2D2D2D',
          hover: '#313131',
        },
        // Text
        text: {
          primary: '#FFFFFF',
          secondary: '#A8A8A8',
          tertiary: '#6B6B6B',
          muted: '#4A4A4A',
        },
        // Border
        border: {
          DEFAULT: '#2D2D2D',
          hover: '#3D3D3D',
          focus: '#FF6363',
        },
        // Status
        success: '#00D9A5',
        warning: '#FFB84D',
        danger: '#FF6B6B',
        // Equipment Colors
        equipment: {
          as360: '#8B5CF6',    // Purple
          micro: '#3B82F6',    // Blue
          xl: '#10B981',       // Green
          xxl: '#F59E0B',      // Amber
          desk: '#EC4899',     // Pink
          table: '#06B6D4',    // Cyan
          compact: '#6366F1',  // Indigo
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'monospace'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      borderRadius: {
        'sm': '0.25rem',
        'DEFAULT': '0.5rem',
        'md': '0.75rem',
        'lg': '1rem',
        'xl': '1.5rem',
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.25)',
        'DEFAULT': '0 2px 8px 0 rgba(0, 0, 0, 0.3)',
        'md': '0 4px 16px 0 rgba(0, 0, 0, 0.35)',
        'lg': '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
        'xl': '0 12px 48px 0 rgba(0, 0, 0, 0.45)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
