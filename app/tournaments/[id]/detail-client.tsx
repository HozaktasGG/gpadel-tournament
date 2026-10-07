'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Share } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { shareLink } from '@/lib/share'

/** Round glass buttons over the hero image (phones). */
export function HeroControls({ title }: { title: string }) {
  const router = useRouter()
  const back = () => {
    const sameOrigin = document.referrer && new URL(document.referrer).origin === window.location.origin
    if (sameOrigin && window.history.length > 1) router.back()
    else router.push('/tournaments')
  }
  const btn =
    'inline-flex size-11 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white backdrop-blur-md transition active:scale-95 active:bg-black/50'
  return (
    <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+12px)] md:hidden">
      <button type="button" onClick={back} className={btn} aria-label="Back">
        <ChevronLeft className="size-6" />
      </button>
      <button
        type="button"
        onClick={() => shareLink({ title, text: `${title} · SmashTorino`, url: window.location.href })}
        className={btn}
        aria-label="Share this event"
      >
        <Share className="size-5" />
      </button>
    </div>
  )
}

export type DetailTab = { value: string; label: string; content: React.ReactNode }

export function DetailTabs({ tabs, defaultValue }: { tabs: DetailTab[]; defaultValue: string }) {
  return (
    <Tabs defaultValue={defaultValue}>
      <TabsList aria-label="Tournament sections">
        {tabs.map(t => (
          <TabsTrigger key={t.value} value={t.value} className="flex-1 sm:flex-none">
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map(t => (
        <TabsContent key={t.value} value={t.value} className="mt-5">
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  )
}

/** Shows the first `initial` children, with a "View all N" toggle. */
export function ExpandableList({
  children,
  initial = 4,
  total,
  noun = 'players',
}: {
  children: React.ReactNode[]
  initial?: number
  total: number
  noun?: string
}) {
  const [all, setAll] = useState(false)
  const shown = all ? children : children.slice(0, initial)
  return (
    <div className="space-y-2">
      {shown}
      {children.length > initial && (
        <Button variant="subtle" block onClick={() => setAll(v => !v)} className="justify-start font-sans text-[15px] font-medium">
          {all ? 'Show fewer' : `View all ${total} ${noun}`}
        </Button>
      )}
    </div>
  )
}
