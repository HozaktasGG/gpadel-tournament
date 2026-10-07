'use client'

import { usePathname } from 'next/navigation'
import { hidesMobileChrome } from './nav-config'

/** Hides site chrome (e.g. the footer) on phones for full-bleed pages. */
export function MobileChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/'
  return <div className={hidesMobileChrome(pathname) ? 'max-md:hidden' : undefined}>{children}</div>
}
