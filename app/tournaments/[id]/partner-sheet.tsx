'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Plus, Check, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { BottomSheet } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input, inputClass } from '@/components/ui/input'
import { Avatar } from '@/components/ui/avatar'
import { SkillBadge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type SheetPlayer = {
  id: string
  first_name: string | null
  last_name: string | null
  skill_level: string | null
  skill_score: number | null
  avatar_url: string | null
  player_code?: string | null
}

const fullName = (p: SheetPlayer | null) => [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim() || 'Player'

// Same normalisation as the previous TeamRegistrationModal.
function normalizeCode(raw: string): string {
  const v = raw.trim().toUpperCase().replace(/\s+/g, '')
  if (!v) return ''
  if (v.startsWith('SMASH-')) return v
  if (v.startsWith('SMASH')) return `SMASH-${v.slice(5)}`
  return `SMASH-${v}`
}

function TeamMember({ p, placeholder }: { p: SheetPlayer | null; placeholder?: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center">
      {p ? (
        <Avatar src={p.avatar_url} name={fullName(p)} size="lg" />
      ) : (
        <span className="flex size-14 items-center justify-center rounded-full border border-dashed border-border-strong text-subtle">?</span>
      )}
      <p className="w-full truncate font-display text-base font-semibold leading-tight">{p ? fullName(p) : placeholder}</p>
      {p && <p className="font-display text-sm text-muted-foreground tabular">{p.skill_score ?? '—'}</p>}
    </div>
  )
}

/** "Register with a partner": team name + find partner by player code + send invite. */
export function PartnerSheet({
  open,
  onOpenChange,
  eventId,
  eventName,
  me,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  eventName: string
  me: SheetPlayer | null
  onSuccess: (partnerName: string) => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [teamName, setTeamName] = useState('')
  const [code, setCode] = useState('')
  const [partner, setPartner] = useState<SheetPlayer | null>(null)
  const [selected, setSelected] = useState(false)
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const codeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
  }, [open])

  const search = async () => {
    setError(null)
    setPartner(null)
    setSelected(false)
    const normalized = normalizeCode(code)
    if (!normalized || normalized.length < 7) {
      setError('Please enter a valid player code.')
      return
    }
    setSearching(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, skill_level, skill_score, avatar_url, player_code')
      .eq('player_code', normalized)
      .maybeSingle<SheetPlayer>()
    setSearching(false)
    if (!data) {
      setError('Player code not found.')
      return
    }
    setPartner(data)
    setCode(normalized)
  }

  const submit = async () => {
    setError(null)
    if (!teamName.trim()) {
      setError('Team name cannot be empty.')
      return
    }
    if (!partner || !selected) {
      setError('Find and add your partner first.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/team-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, team_name: teamName.trim(), partner_code: normalizeCode(code) }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'An error occurred during registration.')
        setSubmitting(false)
        return
      }
      setSubmitting(false)
      onSuccess(data.partner_name || fullName(partner) || 'Partner')
    } catch {
      setError('Connection error. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Register with a partner"
      description={eventName}
      footer={
        <div className="space-y-2">
          <Button block size="lg" onClick={submit} disabled={submitting || !selected || !teamName.trim()}>
            {submitting && <Loader2 className="animate-spin" />}
            {submitting ? 'Sending invite…' : 'Send invite'}
          </Button>
          <p className="text-center text-xs text-muted-foreground">Your spot is confirmed when your partner accepts.</p>
        </div>
      }
    >
      <div className="space-y-6">
        <section className="space-y-2">
          <label htmlFor="team-name" className="text-sm font-semibold">
            Team name
          </label>
          <Input
            id="team-name"
            value={teamName}
            onChange={e => setTeamName(e.target.value.slice(0, 30))}
            maxLength={30}
            placeholder="e.g. Smash Bros"
            autoComplete="off"
            enterKeyHint="next"
            onKeyDown={e => e.key === 'Enter' && codeRef.current?.focus()}
          />
          <p className="text-right text-xs text-subtle tabular">{teamName.length}/30</p>
        </section>

        <section className="space-y-2">
          <label htmlFor="partner-code" className="text-sm font-semibold">
            1. Find your partner
          </label>
          <form
            className="flex gap-2"
            onSubmit={e => {
              e.preventDefault()
              search()
            }}
          >
            <div className="relative flex-1">
              <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-subtle" />
              <input
                id="partner-code"
                ref={codeRef}
                value={code}
                onChange={e => {
                  setCode(e.target.value.toUpperCase().slice(0, 12))
                  setPartner(null)
                  setSelected(false)
                  setError(null)
                }}
                placeholder="SMASH-1234"
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="search"
                className={cn(inputClass, 'pl-12 font-medium tracking-wide')}
              />
            </div>
            <Button type="submit" variant="secondary" size="icon" className="size-12" disabled={searching} aria-label="Search player code">
              {searching ? <Loader2 className="animate-spin" /> : <Search />}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">Ask your partner for the code on their profile.</p>

          {partner && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-pitch-850 p-3">
              <Avatar src={partner.avatar_url} name={fullName(partner)} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-[17px] font-semibold leading-tight">{fullName(partner)}</p>
                <div className="mt-1 flex items-center gap-2">
                  <SkillBadge level={partner.skill_level} />
                  <span className="font-display text-sm tabular text-muted-foreground">{partner.skill_score ?? '—'}</span>
                </div>
              </div>
              <Button
                variant={selected ? 'primary' : 'secondary'}
                size="icon"
                onClick={() => setSelected(s => !s)}
                aria-pressed={selected}
                aria-label={selected ? `Remove ${fullName(partner)}` : `Add ${fullName(partner)} as partner`}
              >
                {selected ? <Check /> : <Plus />}
              </Button>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <p className="text-sm font-semibold">2. Your team</p>
          <div className="flex items-start gap-2 rounded-2xl border border-border bg-pitch-850 p-4">
            <TeamMember p={me} placeholder="You" />
            <span className="mt-4 font-display text-2xl text-muted-foreground" aria-hidden>
              &amp;
            </span>
            <TeamMember p={selected ? partner : null} placeholder="Partner" />
          </div>
        </section>

        {error && (
          <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </BottomSheet>
  )
}
