'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { PlusSquare, Share, X } from 'lucide-react'
import { EASE_OUT } from '@/components/motion'

const KEY = 'st:a2hs-dismissed-at'
const SNOOZE_DAYS = 30
const SHOW_ON = ['/', '/tournaments']

/** Only real iOS Safari can "Add to Home Screen" (not Chrome/Firefox/in-app browsers on iOS). */
function isIOSSafari() {
  const ua = navigator.userAgent
  const iOS = /iP(hone|od|ad)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|DuckDuckGo|GSA\/|FBAN|FBAV|Instagram|Line\/|Snapchat|TikTok/.test(ua)
  return iOS && /Safari\//.test(ua) && !otherBrowser
}

function isStandalone() {
  return (
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(KEY))
    return !!at && Date.now() - at < SNOOZE_DAYS * 86_400_000
  } catch {
    return false
  }
}

/** Dismissible "Add SmashTorino to your Home Screen" card above the bottom nav (iOS Safari tab only). */
export function AddToHomeHint() {
  const pathname = usePathname() ?? '/'
  const [eligible, setEligible] = useState(false)

  useEffect(() => {
    if (!isIOSSafari() || isStandalone() || recentlyDismissed()) return
    const t = setTimeout(() => setEligible(true), 1500)
    return () => clearTimeout(t)
  }, [])

  const dismiss = () => {
    setEligible(false)
    try {
      localStorage.setItem(KEY, String(Date.now()))
    } catch {
      /* private mode: just hide for this visit */
    }
  }

  const show = eligible && SHOW_ON.includes(pathname)

  return (
    <AnimatePresence>
      {show && (
        <motion.aside
          role="complementary"
          aria-label="Install SmashTorino"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.35, ease: EASE_OUT }}
          className="fixed inset-x-3 z-30 md:hidden"
          style={{ bottom: 'calc(var(--bottom-nav-h) + env(safe-area-inset-bottom) + 12px)' }}
        >
          <div className="flex items-start gap-3 rounded-2xl border border-border-strong bg-popover p-4 pr-2 shadow-elevated">
            <img src="/apple-touch-icon.png" alt="" className="size-11 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-semibold leading-tight">Add SmashTorino to your Home Screen</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Tap <Share className="inline size-4 -translate-y-px text-foreground" aria-label="Share" /> then{' '}
                <span className="whitespace-nowrap text-foreground">
                  <PlusSquare className="inline size-4 -translate-y-px" aria-hidden /> Add to Home Screen
                </span>
                .
              </p>
            </div>
            <button
              type="button"
              onClick={dismiss}
              className="-mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="size-5" />
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
