'use client'

import { Toaster as Sonner, toast } from 'sonner'

/** App-wide toasts. Top-center on phones so they clear the bottom nav; offset clears the notch. */
export function Toaster() {
  return (
    <Sonner
      theme="dark"
      position="top-center"
      offset={{ top: 'calc(env(safe-area-inset-top) + 16px)' }}
      mobileOffset={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}
      toastOptions={{
        classNames: {
          toast: '!rounded-2xl !border !border-border-strong !bg-popover !text-foreground !shadow-elevated !font-sans',
          description: '!text-muted-foreground',
          actionButton: '!bg-primary !text-primary-foreground !font-semibold',
          success: '[&_[data-icon]]:!text-success',
          error: '[&_[data-icon]]:!text-destructive',
        },
      }}
    />
  )
}

export { toast }
