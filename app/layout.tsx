import type { Metadata, Viewport } from 'next'
import { Barlow_Condensed, Inter } from 'next/font/google'
import './globals.css'
import Footer from '@/components/Footer'
import { SiteHeader } from '@/components/nav/site-header'
import { BottomNav, BottomNavSpacer } from '@/components/nav/bottom-nav'
import { SessionProvider } from '@/components/nav/session-context'
import { MobileChromeGate } from '@/components/nav/mobile-chrome-gate'
import { MotionProvider } from '@/components/motion'
import { Toaster } from '@/components/ui/sonner'
import { AddToHomeHint } from '@/components/add-to-home-hint'

// Keep in sync with scripts/generate-pwa-assets.mjs.
const SPLASH = [
  { w: 1170, h: 2532, dw: 390, dh: 844 },
  { w: 1284, h: 2778, dw: 428, dh: 926 },
  { w: 1179, h: 2556, dw: 393, dh: 852 },
  { w: 1290, h: 2796, dw: 430, dh: 932 },
  { w: 1206, h: 2622, dw: 402, dh: 874 },
  { w: 1320, h: 2868, dw: 440, dh: 956 },
  { w: 1260, h: 2736, dw: 420, dh: 912 },
]

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })
const barlow = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'SmashTorino — Padel Community of Torino',
  description:
    "Torino's premier padel community. Compete in tournaments, improve with skill assessments, and connect with players around the city.",
  applicationName: 'SmashTorino',
  icons: {
    icon: '/favicon.ico',
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: 'SmashTorino',
    // Content runs under the status bar; headers pad with env(safe-area-inset-top).
    statusBarStyle: 'black-translucent',
    // Dark launch screens (scripts/generate-pwa-assets.mjs).
    startupImage: SPLASH.map(s => ({
      url: `/splash/launch-${s.w}x${s.h}.png`,
      media: `(device-width: ${s.dw}px) and (device-height: ${s.dh}px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)`,
    })),
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#1a3d2e',
  colorScheme: 'dark',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${barlow.variable} bg-background`}>
      <body className="flex min-h-dvh flex-col bg-background font-sans text-foreground">
        <MotionProvider>
          <SessionProvider>
            <SiteHeader />
            <div className="flex flex-1 flex-col">{children}</div>
            <MobileChromeGate>
              <Footer />
            </MobileChromeGate>
            <BottomNavSpacer />
            <BottomNav />
            <AddToHomeHint />
          </SessionProvider>
          <Toaster />
        </MotionProvider>
      </body>
    </html>
  )
}
