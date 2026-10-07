'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

const Tabs = TabsPrimitive.Root

type TabsVariant = 'underline' | 'pill'
const VariantContext = React.createContext<TabsVariant>('underline')

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & { variant?: TabsVariant }
>(({ className, variant = 'underline', ...props }, ref) => (
  <VariantContext.Provider value={variant}>
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        variant === 'underline'
          ? 'flex w-full gap-1 overflow-x-auto border-b border-border [scrollbar-width:none]'
          : 'inline-flex w-full rounded-full border border-border bg-pitch-950/60 p-1',
        className
      )}
      {...props}
    />
  </VariantContext.Provider>
))
TabsList.displayName = 'TabsList'

export const tabTriggerClass = (variant: TabsVariant) =>
  variant === 'underline'
    ? cn(
        'relative inline-flex h-11 min-w-[44px] shrink-0 items-center justify-center px-4 text-[15px] font-medium text-muted-foreground transition-colors',
        'hover:text-foreground data-[state=active]:text-foreground',
        'after:absolute after:inset-x-2 after:-bottom-px after:h-[3px] after:rounded-full after:bg-primary after:opacity-0 after:transition-opacity data-[state=active]:after:opacity-100'
      )
    : cn(
        'inline-flex h-10 flex-1 items-center justify-center rounded-full px-4 text-[15px] font-medium text-muted-foreground transition-colors',
        'hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-pitch-950'
      )

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => {
  const variant = React.useContext(VariantContext)
  return <TabsPrimitive.Trigger ref={ref} className={cn(tabTriggerClass(variant), className)} {...props} />
})
TabsTrigger.displayName = 'TabsTrigger'

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn('mt-4 focus-visible:outline-none data-[state=active]:animate-in data-[state=active]:fade-in-0 motion-reduce:animate-none', className)}
    {...props}
  />
))
TabsContent.displayName = 'TabsContent'

export { Tabs, TabsList, TabsTrigger, TabsContent }
