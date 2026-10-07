'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase-client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AddToCalendarButton } from '@/components/event-actions'
import type { CalendarEvent } from '@/lib/ics'
import { cn } from '@/lib/utils'
import { PartnerSheet, type SheetPlayer } from './partner-sheet'

export type TeamRegState = {
  id: string
  status: 'pending_partner' | 'pending_approval' | 'approved' | 'rejected'
  team_name: string
  captain_id: string
}

export type RegistrationProps = {
  event: CalendarEvent
  isTeam: boolean
  userId: string | null
  me: SheetPlayer | null
  priceLabel: string | null
  isFinished: boolean
  registrationOpen: boolean
  // Individual formats
  isRegistered: boolean
  registrationId: string | null
  isFull: boolean
  // Team formats
  teamRegistration: TeamRegState | null
}

const teamStatus = {
  pending_partner: { icon: Clock, text: 'Waiting for your partner to accept', tone: 'text-skill-intermediate' },
  pending_approval: { icon: Clock, text: 'Waiting for organizer approval', tone: 'text-skill-beginner' },
  approved: { icon: CheckCircle2, text: "You're registered", tone: 'text-success' },
  rejected: { icon: XCircle, text: 'Registration rejected', tone: 'text-destructive' },
} as const

/**
 * Register / cancel logic for the detail page (same Supabase calls and API routes as before).
 * Rendered twice: `bar` = sticky bottom bar on phones, `card` = sidebar on desktop.
 */
export function RegistrationActions(props: RegistrationProps & { variant: 'bar' | 'card' }) {
  const { event, isTeam, userId, me, priceLabel, isFinished, registrationOpen, isRegistered, registrationId, isFull, teamRegistration, variant } = props
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const price = priceLabel && (
    <p className="font-display leading-none">
      <span className="text-[28px] font-bold tabular">{priceLabel}</span>
      {priceLabel !== 'Free' && <span className="ml-1 text-base text-muted-foreground">/ person</span>}
    </p>
  )

  // --- individual (Americano) -------------------------------------------------
  const register = async () => {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      toast.error('You must be signed in.')
      return
    }
    const { error } = await supabase
      .from('event_registrations')
      .upsert({ event_id: event.id, user_id: user.id, status: 'approved' }, { onConflict: 'event_id,user_id' })
    setLoading(false)
    if (error) {
      toast.error("Couldn't register", { description: error.message })
      return
    }
    toast.success("You're in!", { description: 'Add it to your calendar so you don’t miss it.' })
    router.refresh()
  }

  const cancelSolo = async () => {
    if (!registrationId) return
    setLoading(true)
    const { error } = await supabase.from('event_registrations').delete().eq('id', registrationId)
    setLoading(false)
    setConfirmOpen(false)
    if (error) {
      toast.error("Couldn't cancel", { description: error.message })
      return
    }
    toast.success('Registration cancelled')
    router.refresh()
  }

  // --- team -------------------------------------------------------------------
  const cancelTeam = async () => {
    if (!teamRegistration) return
    setLoading(true)
    const res = await fetch('/api/team-registration/cancel', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registration_id: teamRegistration.id }),
    })
    const data = await res.json().catch(() => ({}) as { error?: string })
    setLoading(false)
    setConfirmOpen(false)
    if (!res.ok) {
      toast.error(data.error || 'Action failed.')
      return
    }
    toast.success('Team request cancelled')
    router.refresh()
  }

  const onInviteSent = (partnerName: string) => {
    setSheetOpen(false)
    toast.success('Invite sent!', { description: `Your registration will be confirmed once ${partnerName} accepts.` })
    router.refresh()
  }

  // --- state → UI ------------------------------------------------------------
  let status: React.ReactNode = null
  let action: React.ReactNode = null
  let secondary: React.ReactNode = null

  if (isFinished) {
    status = <p className="text-sm text-muted-foreground">This tournament has finished.</p>
  } else if (!userId) {
    action = (
      <Button asChild size="lg" block={variant === 'card'}>
        <Link href={`/signin?redirect=/tournaments/${event.id}`}>Sign in to register</Link>
      </Button>
    )
    if (variant === 'card')
      secondary = (
        <p className="text-center text-xs text-muted-foreground">
          No account?{' '}
          <Link href="/signup" className="font-medium text-primary-text underline-offset-4 hover:underline">
            Sign up free
          </Link>
        </p>
      )
  } else if (!isTeam) {
    if (isRegistered) {
      status = <StatusLine icon={CheckCircle2} tone="text-success" text="You're registered" />
      action = <AddToCalendarButton event={event} size={variant === 'bar' ? 'md' : 'lg'} block={variant === 'card'} label={variant === 'bar' ? 'Calendar' : 'Add to Calendar'} />
      if (variant === 'card')
        secondary = (
          <Button variant="ghost" size="sm" block onClick={() => setConfirmOpen(true)} disabled={loading}>
            Cancel registration
          </Button>
        )
    } else if (!registrationOpen) {
      action = <DisabledCta label="Registrations closed" block={variant === 'card'} />
    } else if (isFull) {
      action = <DisabledCta label="Tournament full" block={variant === 'card'} />
    } else {
      action = (
        <Button size="lg" block={variant === 'card'} onClick={register} disabled={loading} className={variant === 'bar' ? 'min-w-[160px]' : undefined}>
          {loading && <Loader2 className="animate-spin" />}
          {loading ? 'Registering…' : 'Register solo'}
        </Button>
      )
    }
  } else {
    const reg = teamRegistration
    if (reg) {
      const cfg = teamStatus[reg.status]
      status = <StatusLine icon={cfg.icon} tone={cfg.tone} text={cfg.text} sub={`Team: ${reg.team_name}`} />
      const isCaptain = reg.captain_id === userId
      const canCancel = isCaptain && (reg.status === 'pending_partner' || reg.status === 'pending_approval')
      if (reg.status === 'approved') {
        action = <AddToCalendarButton event={event} size={variant === 'bar' ? 'md' : 'lg'} block={variant === 'card'} label={variant === 'bar' ? 'Calendar' : 'Add to Calendar'} />
      } else if (reg.status === 'rejected' && registrationOpen) {
        action = (
          <Button size="lg" block={variant === 'card'} onClick={() => setSheetOpen(true)}>
            Register again
          </Button>
        )
      } else if (canCancel) {
        action = (
          <Button variant="secondary" size={variant === 'bar' ? 'md' : 'lg'} block={variant === 'card'} onClick={() => setConfirmOpen(true)} disabled={loading}>
            Cancel request
          </Button>
        )
      }
    } else if (!registrationOpen) {
      action = <DisabledCta label="Registrations closed" block={variant === 'card'} />
    } else {
      action = (
        <Button size="lg" block={variant === 'card'} onClick={() => setSheetOpen(true)}>
          Register with a partner
        </Button>
      )
    }
  }

  const confirmDialog = (
    <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isTeam ? 'Cancel team request?' : 'Cancel registration?'}</DialogTitle>
          <DialogDescription>
            {isTeam ? 'Your partner invite will be withdrawn.' : 'Your spot will be released for other players.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Keep it</Button>
          </DialogClose>
          <Button variant="primary" onClick={isTeam ? cancelTeam : cancelSolo} disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            Yes, cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  const sheet = isTeam && userId && (
    <PartnerSheet open={sheetOpen} onOpenChange={setSheetOpen} eventId={event.id} eventName={event.name} me={me} onSuccess={onInviteSent} />
  )

  if (variant === 'bar') {
    if (isFinished) return null
    return (
      <>
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-pitch-950 pb-safe pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] backdrop-blur-md lg:hidden">
          <div className="mx-auto flex min-h-[76px] max-w-2xl items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">{status ?? price}</div>
            <div className="shrink-0">{action}</div>
          </div>
        </div>
        {sheet}
        {confirmDialog}
      </>
    )
  }

  return (
    <div className="space-y-3">
      {price && !isFinished && !status && <div className="pb-1">{price}</div>}
      {status}
      {action}
      {secondary}
      {sheet}
      {confirmDialog}
    </div>
  )
}

function StatusLine({ icon: Icon, tone, text, sub }: { icon: typeof Clock; tone: string; text: string; sub?: string }) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <Icon className={cn('mt-0.5 size-5 shrink-0', tone)} aria-hidden />
      <div className="min-w-0">
        <p className={cn('font-display text-lg font-semibold leading-tight', tone)}>{text}</p>
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  )
}

function DisabledCta({ label, block }: { label: string; block?: boolean }) {
  return (
    <Badge variant="muted" size="md" className={cn('h-12 justify-center rounded-xl px-5 text-sm', block && 'w-full')}>
      {label}
    </Badge>
  )
}
