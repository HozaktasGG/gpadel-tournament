'use client'

import { CalendarPlus, Share } from 'lucide-react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { shareLink } from '@/lib/share'
import { openIcs, type CalendarEvent } from '@/lib/ics'

/** "Share this event": native share sheet, or copy link + toast. */
export function ShareEventButton({
  title,
  url,
  label = 'Share this event',
  ...props
}: { title: string; url: string; label?: string } & Omit<ButtonProps, 'onClick' | 'title'>) {
  return (
    <Button
      variant="ghost"
      onClick={() => shareLink({ title, text: `${title} · SmashTorino`, url: new URL(url, window.location.origin).toString() })}
      {...props}
    >
      <Share aria-hidden />
      {label}
    </Button>
  )
}

/** "Add to Calendar" via a generated .ics (offered after a successful registration). */
export function AddToCalendarButton({
  event,
  label = 'Add to Calendar',
  ...props
}: { event: CalendarEvent; label?: string } & Omit<ButtonProps, 'onClick'>) {
  return (
    <Button
      variant="secondary"
      onClick={() => openIcs({ ...event, url: new URL(event.url, window.location.origin).toString() })}
      {...props}
    >
      <CalendarPlus aria-hidden />
      {label}
    </Button>
  )
}
