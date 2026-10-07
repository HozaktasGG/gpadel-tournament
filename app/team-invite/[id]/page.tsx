'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, CheckCircle2, Clock, Hand, Loader2, MapPin, PartyPopper, SearchX, XCircle } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase-client'

type CaptainEmbed = {
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  player_code?: string | null
}

type EventEmbed = {
  name: string
  date: string | null
  location: string | null
}

type Registration = {
  id: string
  team_name: string
  status: 'pending_partner' | 'pending_approval' | 'approved' | 'rejected'
  partner_confirmed: boolean
  event: EventEmbed | null
  captain: CaptainEmbed | null
}

type RawRegistration = Omit<Registration, 'event' | 'captain'> & {
  event: EventEmbed | EventEmbed[] | null
  captain: CaptainEmbed | CaptainEmbed[] | null
}

type Result = 'accepted' | 'rejected' | null

function unwrap<T>(v: T | T[] | null): T | null {
  if (Array.isArray(v)) return v[0] ?? null
  return v
}

function formatDate(date: string | null): string {
  if (!date) return ''
  try {
    return new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch {
    return date
  }
}

export default function TeamInvitePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const id = params?.id

  const [loading, setLoading] = useState(true)
  const [registration, setRegistration] = useState<Registration | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [responding, setResponding] = useState(false)
  const [result, setResult] = useState<Result>(null)
  const autoRan = useRef(false)

  const handleRespond = useCallback(async (action: 'accept' | 'reject') => {
    if (responding) return
    setResponding(true)
    setError(null)
    try {
      const res = await fetch('/api/team-registration/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registration_id: id, action }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'An error occurred.')
        setResponding(false)
        return
      }
      setResult(action === 'accept' ? 'accepted' : 'rejected')
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setResponding(false)
    }
  }, [id, responding])

  useEffect(() => {
    if (!id) return
    let cancelled = false

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace(`/signin?redirect=/team-invite/${id}`)
        return
      }

      // No FK from team_registrations.captain_id to profiles, so the captain is fetched separately.
      const { data, error: fetchError } = await supabase
        .from('team_registrations')
        .select('id, team_name, status, partner_confirmed, captain_id, event:events(name, date, location)')
        .eq('id', id)
        .single()

      if (cancelled) return

      if (fetchError || !data) {
        setError('Invite not found.')
        setLoading(false)
        return
      }

      const { captain_id, ...rest } = data as unknown as Omit<RawRegistration, 'captain'> & { captain_id: string | null }
      const { data: captainData } = captain_id
        ? await supabase
            .from('profiles')
            .select('first_name, last_name, avatar_url, player_code')
            .eq('id', captain_id)
            .maybeSingle()
        : { data: null }

      if (cancelled) return

      const raw: RawRegistration = { ...rest, captain: (captainData as CaptainEmbed | null) ?? null }
      const reg: Registration = {
        id: raw.id,
        team_name: raw.team_name,
        status: raw.status,
        partner_confirmed: raw.partner_confirmed,
        event: unwrap(raw.event),
        captain: unwrap(raw.captain),
      }

      setRegistration(reg)
      setLoading(false)

      const action = searchParams?.get('action')
      if (
        !autoRan.current &&
        reg.status === 'pending_partner' &&
        (action === 'accept' || action === 'reject')
      ) {
        autoRan.current = true
        handleRespond(action)
      }
    }

    load()
    return () => { cancelled = true }
  }, [id, router, searchParams, supabase, handleRespond])

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 space-y-4 px-4 py-10" aria-busy="true">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </main>
    )
  }

  if (error && !registration) {
    return <StatusCard icon={SearchX} title="Invite not found" text={error} href="/" cta="Home" />
  }

  if (result === 'accepted') {
    return (
      <StatusCard
        icon={PartyPopper}
        tone="success"
        title="You accepted the invite!"
        text={<>You joined <strong className="text-foreground">“{registration?.team_name}”</strong>. See you at the tournament!</>}
        href="/dashboard"
        cta="Go to dashboard"
      />
    )
  }

  if (result === 'rejected') {
    return <StatusCard icon={Hand} title="Invite declined" text="You declined the invite. The captain has been notified." href="/" cta="Home" />
  }

  if (!registration) return null

  if (registration.status !== 'pending_partner') {
    const info = {
      pending_approval: { icon: Clock, title: 'Awaiting approval', text: 'You already responded to this invite. Awaiting admin approval.', tone: undefined },
      approved: { icon: CheckCircle2, title: 'Team approved', text: 'This team is already approved.', tone: 'success' as const },
      rejected: { icon: XCircle, title: 'Invite declined', text: 'This invite has been declined.', tone: undefined },
    }[registration.status]

    return <StatusCard icon={info.icon} tone={info.tone} title={info.title} text={info.text} href="/dashboard" cta="Go to dashboard" />
  }

  const captain = registration.captain
  const captainName = [captain?.first_name, captain?.last_name].filter(Boolean).join(' ').trim() || 'A player'
  const event = registration.event

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pb-10 pt-6 md:pt-10">
      <p className="flex items-center gap-2 font-display text-xl font-semibold">
        <span className="size-2.5 rounded-full bg-primary" aria-hidden />
        Partner invite
      </p>
      <h1 className="mt-1 font-display text-[40px] font-bold leading-none">You have an invite!</h1>

      <Card className="mt-5 p-5">
        <div className="flex items-center gap-4">
          <Avatar src={captain?.avatar_url} name={captainName} size="lg" />
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">
              <span className="text-foreground">{captainName}</span> wants to team up
            </p>
            {captain?.player_code && <p className="text-xs text-subtle">{captain.player_code}</p>}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border bg-pitch-850 p-4">
          <p className="text-overline font-semibold uppercase text-subtle">Team name</p>
          <p className="mt-1 font-display text-[26px] font-bold leading-tight text-primary-text">{registration.team_name}</p>
        </div>

        {event && (
          <div className="mt-3 rounded-xl border border-border bg-pitch-850 p-4">
            <p className="text-overline font-semibold uppercase text-subtle">Event</p>
            <p className="mt-1 font-display text-xl font-semibold leading-tight">{event.name}</p>
            {event.date && (
              <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="size-4" aria-hidden />
                {formatDate(event.date)}
              </p>
            )}
            {event.location && (
              <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="size-4" aria-hidden />
                {event.location}
              </p>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button variant="secondary" size="lg" onClick={() => handleRespond('reject')} disabled={responding}>
            Decline
          </Button>
          <Button size="lg" onClick={() => handleRespond('accept')} disabled={responding}>
            {responding && <Loader2 className="animate-spin" />}
            {responding ? 'Processing…' : 'Accept'}
          </Button>
        </div>
      </Card>
    </main>
  )
}

function StatusCard({
  icon: Icon,
  title,
  text,
  href,
  cta,
  tone,
}: {
  icon: typeof Clock
  title: string
  text: React.ReactNode
  href: string
  cta: string
  tone?: 'success'
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-10">
      <Card className="w-full p-8 text-center">
        <span className={`mx-auto flex size-14 items-center justify-center rounded-full ${tone === 'success' ? 'bg-success/15 text-success' : 'bg-white/5 text-muted-foreground'}`}>
          <Icon className="size-7" aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-[28px] font-bold leading-tight">{title}</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">{text}</p>
        <Button asChild size="lg" className="mt-6">
          <Link href={href}>{cta}</Link>
        </Button>
      </Card>
    </main>
  )
}
