'use client'

import { useEffect } from 'react'

// iOS Safari ignores `overflow: hidden` on body for touch scrolling, so pin the
// body with position:fixed and restore the scroll position afterwards.
// Ref-counted so nested overlays don't unlock each other.
let locks = 0
let savedY = 0
let saved: Partial<CSSStyleDeclaration> = {}

function lock() {
  if (locks++ > 0) return
  const b = document.body.style
  savedY = window.scrollY
  saved = { position: b.position, top: b.top, left: b.left, right: b.right, width: b.width, overflow: b.overflow }
  b.position = 'fixed'
  b.top = `-${savedY}px`
  b.left = '0'
  b.right = '0'
  b.width = '100%'
  b.overflow = 'hidden'
}

function unlock() {
  if (--locks > 0) return
  locks = 0
  Object.assign(document.body.style, saved)
  window.scrollTo(0, savedY)
}

/** Locks background scroll while `active` (for overlays not built on Radix). */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    lock()
    return unlock
  }, [active])
}
