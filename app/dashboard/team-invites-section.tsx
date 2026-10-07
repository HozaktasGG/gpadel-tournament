'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, ChevronRight, Loader2, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase-client'
import { formatEventDate } from '@/lib/event-status'
import { Avatar, AvatarPair } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type ProfileRow = {
  id: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
}

type EventRow = {
  id: string
  name: string | null
  date: string | null
  time: string | null
  location: string | null
}

type SentInvite = {
  id: string
  team_name: string
  status: 'pending_partner'
  created_at: string
  event_id: string | null
  partner_id: string | null
}

type ReceivedInvite = {
  id: string
  team_name: string
  status: 'pending_partner'
  created_at: string
  event_id: string | null
  captain_id: string | null
}

type Props = {
  userId: string
  me: { name: string; avatarUrl: string | null }
}

function fullName(p: ProfileRow | null | undefined, fallback = 'Player'): string {
  if (!p) return fallback
  return [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || fallback
}

function EventMeta({ ev }: { ev: EventRow | undefined }) {
  if (!ev) return null
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
      {ev.date && (
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-4" aria-hidden />
          {[formatEventDate(ev.date, 'short'), ev.time].filter(Boolean).join(' · ')}
        </span>
      )}
      {ev.location && (
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="size-4" aria-hidden />
          {ev.location}
        </span>
      )}
    </p>
  )
}

/** Partner invites: received (Accept / Decline) and sent (waiting, Cancel request). Same API routes as before. */
export default function TeamInvitesSection({ userId, me }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [sent, setSent] = useState<SentInvite[]>([])
  const [received, setReceived] = useState<ReceivedInvite[]>([])
  const [events, setEvents] = useState<EventRow[]>([])
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [actionId, setActionId] = useState<string | null>(null)
  const [cancelId, setCancelId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)

      const [{ data: sentInvites }, { data: receivedInvites }] = await Promise.all([
        supabase
          .from('team_registrations')
          .select('id, team_name, status, created_at, event_id, partner_id')
          .eq('captain_id', userId)
          .eq('status', 'pending_partner')
          .order('created_at', { ascending: false }),
        supabase
          .from('team_registrations')
          .select('id, team_name, status, created_at, event_id, captain_id')
          .eq('partner_id', userId)
          .eq('status', 'pending_partner')
          .order('created_at', { ascending: false }),
      ])

      if (cancelled) return

      const sentRows = (sentInvites ?? []) as SentInvite[]
      const receivedRows = (receivedInvites ?? []) as ReceivedInvite[]

      const eventIds = Array.from(
        new Set([...sentRows, ...receivedRows].map(r => r.event_id).filter((id): id is string => !!id))
      )

      const profileIds = Array.from(
        new Set(
          [...sentRows.map(r => r.partner_id), ...receivedRows.map(r => r.captain_id)].filter((id): id is string => !!id)
        )
      )

      const [{ data: eventsData }, { data: profilesData }] = await Promise.all([
        eventIds.length
          ? supabase.from('events').select('id, name, date, time, location').in('id', eventIds)
          : Promise.resolve({ data: [] as EventRow[] }),
        profileIds.length
          ? supabase.from('profiles').select('id, first_name, last_name, avatar_url, player_code').in('id', profileIds)
          : Promise.resolve({ data: [] as ProfileRow[] }),
      ])

      if (cancelled) return

      setSent(sentRows)
      setReceived(receivedRows)
      setEvents((eventsData ?? []) as EventRow[])
      setProfiles((profilesData ?? []) as ProfileRow[])
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [userId, supabase])

  const getEvent = (id: string | null) => (id ? events.find(e => e.id === id) : undefined)
  const getProfile = (id: string | null) => (id ? profiles.find(p => p.id === id) : undefined)

  const handleCancel = async (id: string) => {
    setActionId(id)
    const res = await fetch('/api/team-registration/cancel', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registration_id: id }),
    })
    const data = await res.json().catch(() => ({}) as { error?: string })
    setActionId(null)
    setCancelId(null)
    if (!res.ok) {
      toast.error(data.error || 'Action failed.')
      return
    }
    toast.success('Team request cancelled')
    setSent(prev => prev.filter(s => s.id !== id))
  }

  const handleRespond = async (id: string, action: 'accept' | 'reject') => {
    setActionId(id)
    const res = await fetch('/api/team-registration/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registration_id: id, action }),
    })
    const data = await res.json().catch(() => ({}) as { error?: string })
    setActionId(null)
    if (!res.ok) {
      toast.error(data.error || 'Action failed.')
      return
    }
    toast.success(action === 'accept' ? 'Invite accepted — you’re on the team!' : 'Invite declined')
    setReceived(prev => prev.filter(r => r.id !== id))
  }

  if (loading) return <Skeleton className="mb-4 h-40 w-full rounded-2xl" />
  if (sent.length === 0 && received.length === 0) return null

  return (
    <div className="mb-4 space-y-3">
      {received.map(inv => {
        const ev = getEvent(inv.event_id)
        const captain = getProfile(inv.captain_id)
        const captainName = fullName(captain, 'Your partner')
        const busy = actionId === inv.id
        return (
          <Card key={inv.id} className="border-primary/25 p-4">
            <p className="flex items-center gap-2 font-display text-xl font-semibold">
              <span className="size-2.5 rounded-full bg-primary" aria-hidden />
              Partner invite
            </p>
            <div className="mt-3 flex items-start gap-3">
              <Avatar src={captain?.avatar_url} name={captainName} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground">
                  <span className="text-foreground">{captainName}</span> invited you to
                </p>
                {ev ? (
                  <Link href={`/tournaments/${ev.id}`} className="font-display text-[22px] font-semibold leading-tight hover:underline">
                    {ev.name}
                  </Link>
                ) : (
                  <p className="font-display text-[22px] font-semibold leading-tight">a tournament</p>
                )}
                <EventMeta ev={ev} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-pitch-850 px-3 py-2.5">
              <span className="text-sm text-muted-foreground">Team preview</span>
              <AvatarPair a={{ name: captainName, src: captain?.avatar_url }} b={{ name: me.name, src: me.avatarUrl }} size="sm" />
              <span className="min-w-0 truncate font-medium">{inv.team_name}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Button variant="secondary" size="lg" disabled={busy} onClick={() => handleRespond(inv.id, 'reject')}>
                Decline
              </Button>
              <Button size="lg" disabled={busy} onClick={() => handleRespond(inv.id, 'accept')}>
                {busy && <Loader2 className="animate-spin" />}
                Accept
              </Button>
            </div>
          </Card>
        )
      })}

      {sent.map(inv => {
        const ev = getEvent(inv.event_id)
        const partner = getProfile(inv.partner_id)
        const partnerName = fullName(partner, 'your partner')
        return (
          <Card key={inv.id} className="p-4">
            <div className="flex items-start gap-3">
              <AvatarPair a={{ name: me.name, src: me.avatarUrl }} b={{ name: partnerName, src: partner?.avatar_url }} size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-skill-intermediate">Waiting for {partnerName} to accept</p>
                <p className="truncate font-display text-lg font-semibold leading-tight">{inv.team_name}</p>
                {ev && (
                  <Link href={`/tournaments/${ev.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                    {ev.name}
                    <ChevronRight className="size-4" aria-hidden />
                  </Link>
                )}
              </div>
            </div>
            <Button variant="ghost" size="sm" className="mt-2 text-destructive" disabled={actionId === inv.id} onClick={() => setCancelId(inv.id)}>
              Cancel request
            </Button>
          </Card>
        )
      })}

      <Dialog open={!!cancelId} onOpenChange={o => !o && setCancelId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel team request?</DialogTitle>
            <DialogDescription>Your partner invite will be withdrawn.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Keep it</Button>
            </DialogClose>
            <Button onClick={() => cancelId && handleCancel(cancelId)} disabled={!!actionId}>
              {actionId && <Loader2 className="animate-spin" />}
              Yes, cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
