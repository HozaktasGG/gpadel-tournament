'use client'

import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      // 44px tall hit area around a 28px track.
      'relative inline-flex h-7 w-[52px] shrink-0 cursor-pointer items-center rounded-full border border-border-strong transition-colors',
      'before:absolute before:-inset-2 before:content-[""]',
      'data-[state=checked]:border-transparent data-[state=checked]:bg-success-solid data-[state=unchecked]:bg-white/10',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="pointer-events-none block size-[22px] translate-x-[3px] rounded-full bg-white shadow transition-transform duration-200 ease-out data-[state=checked]:translate-x-[26px] data-[state=checked]:bg-lime" />
  </SwitchPrimitive.Root>
))
Switch.displayName = 'Switch'

export { Switch }
