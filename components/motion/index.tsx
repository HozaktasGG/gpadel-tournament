'use client'

import * as React from 'react'
import { AnimatePresence, MotionConfig, motion, useReducedMotion, type Variants } from 'motion/react'
import { cn } from '@/lib/utils'

export const EASE_OUT = [0.22, 1, 0.36, 1] as const

/** Root provider: honours the OS "Reduce motion" setting for every motion component. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.02 } },
}
const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT } },
}

/** Staggered fade-up list. Children should be <FadeUpItem>. */
export function Stagger({
  children,
  className,
  as = 'div',
}: {
  children: React.ReactNode
  className?: string
  as?: 'div' | 'ul' | 'ol' | 'section'
}) {
  const Comp = motion[as]
  return (
    <Comp className={className} variants={container} initial="hidden" whileInView="show" viewport={{ once: true, margin: '0px 0px -40px 0px' }}>
      {children}
    </Comp>
  )
}

export function FadeUpItem({
  children,
  className,
  as = 'div',
}: {
  children: React.ReactNode
  className?: string
  as?: 'div' | 'li' | 'article'
}) {
  const Comp = motion[as]
  return (
    <Comp className={className} variants={item}>
      {children}
    </Comp>
  )
}

/** Number that flips vertically when its value changes (live scores). */
export function FlipNumber({ value, className }: { value: number | string; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <span className={cn('relative inline-flex overflow-hidden tabular', className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={String(value)}
          initial={reduce ? false : { y: '-60%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { y: '60%', opacity: 0 }}
          transition={{ duration: 0.3, ease: EASE_OUT }}
          className="inline-block"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

export { motion, AnimatePresence }
