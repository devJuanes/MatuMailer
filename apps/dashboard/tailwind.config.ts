import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        cream: 'hsl(var(--cream))',
        gold: {
          DEFAULT: 'hsl(var(--gold))',
          light: '#FFE566',
          dark: '#E5B82E',
        },
        charcoal: 'hsl(var(--charcoal))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 8px)',
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      boxShadow: {
        soft: '0 4px 24px -4px rgba(0, 0, 0, 0.06), 0 8px 16px -8px rgba(0, 0, 0, 0.04)',
        'soft-lg': '0 8px 40px -8px rgba(0, 0, 0, 0.1), 0 16px 24px -12px rgba(0, 0, 0, 0.06)',
        glow: '0 0 40px -10px hsl(46 100% 64% / 0.4)',
      },
    },
  },
  plugins: [animate],
};

export default config;
