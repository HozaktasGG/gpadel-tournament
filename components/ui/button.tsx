import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-display font-semibold tracking-[0.01em]',
    'select-none transition-[background-color,border-color,color,transform,box-shadow] duration-150 ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-50 motion-safe:active:scale-[0.97]',
    '[&_svg]:pointer-events-none [&_svg]:size-[1.1em] [&_svg]:shrink-0',
  ].join(' '),
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground shadow-cta hover:bg-primary-hover active:bg-primary-pressed',
        secondary:
          'border border-border-strong bg-transparent text-foreground hover:bg-white/5 active:bg-white/10',
        subtle: 'bg-secondary text-foreground hover:bg-pitch-600 active:bg-pitch-700',
        ghost: 'text-foreground hover:bg-white/5 active:bg-white/10',
        danger: 'text-destructive hover:bg-destructive/10 active:bg-destructive/15',
        link: 'text-primary-text underline-offset-4 hover:underline active:opacity-80',
      },
      size: {
        sm: 'h-10 px-3.5 text-[15px]',
        md: 'h-11 px-5 text-base',
        lg: 'h-12 px-6 text-lg',
        icon: 'size-11 text-base',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : type ?? 'button'}
        className={cn(buttonVariants({ variant, size, block }), className)}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
