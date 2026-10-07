import type { Metadata, Viewport } from 'next'
import { Barlow_Condensed, Inter } from 'next/font/google'
import './globals.css'
import Footer from '@/components/Footer'
import { SiteHeader } from '@/components/nav/site-header'
import { BottomNav, BottomNavSpacer } from '@/components/nav/bottom-nav'
import { SessionProvider } from '@/components/nav/session-context'
import { MotionProvider } from '@/components/motion'
import { Toaster } from '@/components/ui/sonner'

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
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    statusBarStyle: 'black-translucent',
  },
}

export const viewport: Viewport = {
  themeColor: '#1a3d2e',
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
            <Footer />
            <BottomNavSpacer />
            <BottomNav />
          </SessionProvider>
          <Toaster />
        </MotionProvider>
      </body>
    </html>
  )
}
