import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'rounded-full bg-charcoal text-white shadow-soft hover:bg-charcoal/90 hover:shadow-soft-lg',
        gold: 'rounded-full bg-gold text-charcoal shadow-soft hover:bg-gold-light hover:shadow-glow',
        secondary: 'rounded-full bg-white/80 text-foreground border border-border/80 hover:bg-white shadow-sm',
        outline: 'rounded-full border-2 border-charcoal/10 bg-transparent hover:bg-white/60',
        ghost: 'rounded-full hover:bg-white/70 text-muted-foreground hover:text-foreground',
        destructive: 'rounded-full bg-red-500 text-white hover:bg-red-600',
        glass: 'rounded-full bg-white/70 backdrop-blur-md border border-white/60 text-foreground hover:bg-white/90 shadow-soft',
      },
      size: {
        default: 'h-11 px-6 py-2',
        sm: 'h-9 rounded-full px-4 text-xs',
        lg: 'h-12 rounded-full px-8 text-base',
        icon: 'h-11 w-11 rounded-full',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
