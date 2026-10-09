'use client'

import { motion } from 'motion/react'
import { EASE_OUT } from '@/components/motion'

/** Re-mounts on every navigation: a short fade-up page transition (off under Reduce Motion). */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="flex flex-1 flex-col"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  )
}
