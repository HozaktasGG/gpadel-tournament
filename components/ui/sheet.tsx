'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { AnimatePresence, motion, useDragControls, useReducedMotion, type PanInfo } from 'motion/react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EASE_OUT } from '@/components/motion'

/**
 * Bottom sheet on phones, centered panel from md up.
 * Radix Dialog handles focus trap, Esc and background scroll lock (iOS-safe).
 * Content sits above the home indicator via env(safe-area-inset-bottom).
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  bodyClassName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  /** Sticky action area (e.g. primary button). */
  footer?: React.ReactNode
  className?: string
  /** Overrides the body padding (e.g. children that bring their own). */
  bodyClassName?: string
}) {
  const reduce = useReducedMotion()
  const drag = useDragControls()
  const [isDesktop, setIsDesktop] = React.useState(false)

  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const update = () => setIsDesktop(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onOpenChange(false)
  }

  const hidden = reduce ? { opacity: 0 } : isDesktop ? { opacity: 0, scale: 0.97, y: 8 } : { y: '100%' }
  const shown = reduce ? { opacity: 1 } : isDesktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild forceMount {...(description ? {} : { 'aria-describedby': undefined })}>
              <motion.div
                className={cn(
                  'fixed z-50 flex flex-col border border-border-strong bg-popover text-foreground shadow-elevated focus:outline-none',
                  'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl',
                  // Desktop: centered with margins (motion owns `transform`, so no translate classes).
                  'md:bottom-auto md:top-[12dvh] md:mx-auto md:max-h-[76dvh] md:w-full md:max-w-lg md:rounded-3xl',
                  className
                )}
                initial={hidden}
                animate={shown}
                exit={hidden}
                transition={{ duration: reduce ? 0.15 : 0.35, ease: EASE_OUT }}
                drag={!isDesktop && !reduce ? 'y' : false}
                dragControls={drag}
                dragListener={false}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.6 }}
                onDragEnd={onDragEnd}
              >
                <div
                  className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-3 md:hidden"
                  onPointerDown={e => drag.start(e)}
                  aria-hidden
                >
                  <span className="h-1.5 w-11 rounded-full bg-white/25" />
                </div>
                <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-2 md:pt-5">
                  <div className="min-w-0">
                    <DialogPrimitive.Title className="font-display text-[22px] font-semibold leading-tight">{title}</DialogPrimitive.Title>
                    {description && (
                      <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">{description}</DialogPrimitive.Description>
                    )}
                  </div>
                  <DialogPrimitive.Close
                    className="-mr-2 -mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                    aria-label="Close"
                  >
                    <X className="size-5" />
                  </DialogPrimitive.Close>
                </div>
                <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4', bodyClassName)}>{children}</div>
                {footer ? (
                  <div className="shrink-0 border-t border-border px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-5">{footer}</div>
                ) : (
                  <div className="shrink-0 pb-[env(safe-area-inset-bottom)] md:pb-1" />
                )}
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  )
}
