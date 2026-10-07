'use client'

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Download,
  ExternalLink,
  Network,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
  Users,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatEventDate, formatPrice } from '@/lib/event-status'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge, SkillBadge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { SearchInput } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { EmptyState } from '@/components/ui/empty-state'
import { searchKey } from '@/lib/search'
import type { ActionResult } from './actions'
import { addRegistrations, removeRegistration, setRegistrationOpen, setRegistrationStatus, updateEvent, updateProfile } from './actions'
import ProfilePicker from './profile-picker'
import TeamsSection from './teams-section'
import type { AdminEvent, AdminProfile, AdminRegistration, AdminTeam } from './types'
import { fullName, isTeamFormat } from './types'
import { Avatar, C, PrimaryButton, Sheet, inputCls, labelCls, useConfirm, useToasts } from './ui'

export type AdminCtx = {
  eventId: string
  profiles: AdminProfile[]
  profileMap: Map<string, AdminProfile>
  hasFixtures: boolean
  fixtureNote: ReactNode
  capacityNote: (adding: number) => ReactNode
  run: <T>(p: Promise<ActionResult<T>>, success: string | ((data: T | undefined) => string)) => Promise<boolean>
  ask: ReturnType<typeof useConfirm>['ask']
  confirmFixtures: () => Promise<boolean>
  editProfile: (id: string) => void
}

const FORMATS = ['Americano', 'Team Americano', 'Team', 'Round Robin', 'Elimination']
const STATUSES = ['upcoming', 'active', 'completed']

function Warning({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-skill-intermediate/30 bg-skill-intermediate/10 px-3 py-2 text-sm text-skill-intermediate">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}

export default function EventAdmin({
  event,
  registrations,
  teams,
  profiles,
  hasFixtures,
}: {
  event: AdminEvent
  registrations: AdminRegistration[]
  teams: AdminTeam[]
  profiles: AdminProfile[]
  hasFixtures: boolean
}) {
  const router = useRouter()
  const { ask, dialog } = useConfirm()
  const { push, view: toastView } = useToasts()

  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles])
  const teamFormat = isTeamFormat(event.format)

  const run = useCallback(
    async <T,>(p: Promise<ActionResult<T>>, success: string | ((data: T | undefined) => string)) => {
      let res: ActionResult<T>
      try {
        res = await p
      } catch (e) {
        push('error', e instanceof Error ? e.message : 'Network error.')
        return false
      }
      if (!res.ok) {
        push('error', res.error)
        return false
      }
      push('success', typeof success === 'string' ? success : success(res.data))
      router.refresh()
      return true
    },
    [push, router]
  )

  const fixtureNote = hasFixtures ? (
    <Warning>
      This tournament already has generated rounds/matches. Changing participants or teams may make existing fixtures inconsistent. Fixtures and scores are not changed automatically.
    </Warning>
  ) : null

  const confirmFixtures = useCallback(async () => {
    if (!hasFixtures) return true
    const { ok } = await ask({ title: 'Fixtures already exist', message: fixtureNote, confirmLabel: 'Continue anyway' })
    return ok
  }, [hasFixtures, ask, fixtureNote])

  // Capacity, counted the same way as the public event page.
  const filled = teamFormat ? teams.filter(t => t.status === 'approved').length * 2 : registrations.filter(r => r.status === 'approved').length
  const capacity = event.max_players ?? 0
  const capacityNote = (adding: number) =>
    capacity > 0 && filled + adding > capacity ? (
      <Warning>
        This exceeds max players: {filled + adding} / {capacity}. Admin adds are still allowed.
      </Warning>
    ) : null

  // ───── Profile quick edit ─────
  const [profileEdit, setProfileEdit] = useState<{ id: string; first_name: string; last_name: string; player_code: string } | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const editProfile = useCallback(
    (id: string) => {
      const p = profileMap.get(id)
      if (!p) return
      setProfileEdit({ id, first_name: p.first_name ?? '', last_name: p.last_name ?? '', player_code: p.player_code ?? '' })
    },
    [profileMap]
  )
  const saveProfile = async () => {
    if (!profileEdit) return
    setSavingProfile(true)
    const ok = await run(updateProfile(event.id, profileEdit.id, profileEdit), 'Profile updated')
    setSavingProfile(false)
    if (ok) setProfileEdit(null)
  }

  const [editingDetails, setEditingDetails] = useState(false)

  const ctx: AdminCtx = {
    eventId: event.id,
    profiles,
    profileMap,
    hasFixtures,
    fixtureNote,
    capacityNote,
    run,
    ask,
    confirmFixtures,
    editProfile,
  }

  const open = event.registration_open
  const startLabel = [formatEventDate(event.date, 'short').replace(/^\w+, /, ''), event.time].filter(Boolean).join(' · ')

  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 pb-10 pt-4 md:px-8 md:pt-6">
      {toastView}
      {dialog}

      {/* Breadcrumb (desktop) / back (phones) */}
      <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin#events" className="inline-flex min-h-11 items-center gap-1.5 hover:text-foreground">
          <ArrowLeft className="size-4 md:hidden" aria-hidden />
          Events
        </Link>
        <ChevronRight className="hidden size-4 md:block" aria-hidden />
        <span className="hidden truncate text-foreground/80 md:block">{event.name}</span>
      </nav>

      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[36px] font-bold leading-none md:text-hero">Manage event</h1>
          <p className="mt-1 truncate text-[17px] text-foreground/85 md:text-lg">
            {event.name}
            {event.format && <span className="text-muted-foreground"> · {event.format}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={open ? 'success' : 'muted'} size="md" className={cn('h-10 px-3 text-sm md:px-4', open && 'border border-success/30')}>
            <span className={cn('size-2 rounded-full', open ? 'bg-success' : 'bg-subtle')} aria-hidden />
            {open ? 'Registration open' : 'Registration closed'}
          </Badge>
          <Button variant="secondary" size="sm" onClick={() => setEditingDetails(true)} aria-label="Edit details" className="max-md:size-11 max-md:px-0">
            <Pencil />
            <span className="max-md:hidden">Edit details</span>
          </Button>
          {event.pdf_url && (
            <Button asChild variant="secondary" size="sm">
              <a href={event.pdf_url} target="_blank" rel="noopener noreferrer">
                <Download />
                <span className="max-md:hidden">PDF</span>
              </a>
            </Button>
          )}
          <Button asChild variant="ghost" size="sm" className="max-md:size-11 max-md:px-0">
            <Link href={`/tournaments/${event.id}`} aria-label="Public page">
              <ExternalLink />
              <span className="max-md:hidden">Public page</span>
            </Link>
          </Button>
        </div>
      </header>

      {/* Stat cards */}
      <div className="mt-5 grid grid-cols-3 gap-2 md:gap-4">
        <StatCard icon={Users} value={capacity > 0 ? `${filled} / ${capacity}` : String(filled)} label="Players" />
        <StatCard icon={Wallet} value={formatPrice(event.entry_fee) ?? '—'} label="Entry fee" />
        <StatCard icon={CalendarDays} value={startLabel || '—'} label="Start" />
      </div>

      {/* Registration + capacity */}
      <Card className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
        <RegistrationToggle event={event} run={run} ask={ask} />
        <span className="hidden h-8 w-px bg-border md:block" aria-hidden />
        <CapacityControl event={event} run={run} />
      </Card>

      {fixtureNote && <div className="mt-3">{fixtureNote}</div>}

      <Tabs defaultValue="participants" className="mt-5">
        <TabsList>
          <TabsTrigger value="participants">Participants</TabsTrigger>
          {teamFormat && <TabsTrigger value="teams">Teams</TabsTrigger>}
          <TabsTrigger value="fixtures">Fixtures</TabsTrigger>
        </TabsList>
        <TabsContent value="participants">
          <ParticipantsSection ctx={ctx} event={event} registrations={registrations} teams={teams} />
        </TabsContent>
        {teamFormat && (
          <TabsContent value="teams">
            <TeamsSection ctx={ctx} registrations={registrations} teams={teams} />
          </TabsContent>
        )}
        <TabsContent value="fixtures">
          <FixturesCard event={event} hasFixtures={hasFixtures} />
        </TabsContent>
      </Tabs>

      <EventDetails event={event} run={run} open={editingDetails} onClose={() => setEditingDetails(false)} />

      <Sheet
        open={!!profileEdit}
        onClose={() => setProfileEdit(null)}
        title="Edit profile"
        footer={
          <PrimaryButton className="w-full" onClick={saveProfile} disabled={savingProfile}>
            {savingProfile ? 'Saving…' : 'Save profile'}
          </PrimaryButton>
        }
      >
        {profileEdit && (
          <div className="space-y-3 px-5 pb-4">
            <p className="break-all text-sm text-muted-foreground">{profileMap.get(profileEdit.id)?.email}</p>
            <label className="block">
              <span className={labelCls}>First name</span>
              <input className={inputCls} style={C.input} value={profileEdit.first_name} onChange={e => setProfileEdit({ ...profileEdit, first_name: e.target.value })} />
            </label>
            <label className="block">
              <span className={labelCls}>Last name</span>
              <input className={inputCls} style={C.input} value={profileEdit.last_name} onChange={e => setProfileEdit({ ...profileEdit, last_name: e.target.value })} />
            </label>
            <label className="block">
              <span className={labelCls}>Player code</span>
              <input
                className={`${inputCls} font-mono uppercase`}
                style={C.input}
                value={profileEdit.player_code}
                autoCapitalize="characters"
                onChange={e => setProfileEdit({ ...profileEdit, player_code: e.target.value })}
              />
            </label>
          </div>
        )}
      </Sheet>
    </main>
  )
}

function StatCard({ icon: Icon, value, label }: { icon: typeof Users; value: string; label: string }) {
  return (
    <Card className="flex min-w-0 flex-col gap-2 p-3 md:flex-row md:items-center md:gap-4 md:p-5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border-strong text-muted-foreground md:size-12">
        <Icon className="size-4 md:size-6" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="break-words font-display text-lg font-bold leading-tight tabular md:truncate md:text-[32px] md:leading-none">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground md:text-base">{label}</p>
      </div>
    </Card>
  )
}

// ───────────────────────── Registration open/close ─────────────────────────

function RegistrationToggle({ event, run, ask }: { event: AdminEvent; run: AdminCtx['run']; ask: AdminCtx['ask'] }) {
  const [saving, setSaving] = useState(false)
  const open = event.registration_open

  const toggle = async () => {
    const { ok } = await ask({
      title: open ? 'Close registrations?' : 'Open registrations?',
      message: open
        ? 'Players will no longer be able to register on the public page. You can still add people here.'
        : 'Players will be able to register on the public page again.',
      confirmLabel: open ? 'Close' : 'Open',
      destructive: open,
    })
    if (!ok) return
    setSaving(true)
    await run(setRegistrationOpen(event.id, !open), open ? 'Registrations closed' : 'Registrations opened')
    setSaving(false)
  }

  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-4">
      <span className="text-[15px] font-medium">{saving ? 'Saving…' : 'Registration open'}</span>
      <Switch checked={open} onCheckedChange={toggle} disabled={saving} aria-label="Registration open" />
    </label>
  )
}

// ───────────────────────── Capacity (max players) ─────────────────────────

function CapacityControl({ event, run }: { event: AdminEvent; run: AdminCtx['run'] }) {
  const [value, setValue] = useState<string>(event.max_players != null ? String(event.max_players) : '')
  const [saving, setSaving] = useState(false)
  const current = event.max_players != null ? String(event.max_players) : ''
  const dirty = value !== current

  // Same updateEvent action as the details editor, changing only max_players.
  const save = async () => {
    setSaving(true)
    const ok = await run(
      updateEvent(event.id, {
        name: event.name,
        date: event.date,
        time: event.time,
        location: event.location,
        max_players: value === '' ? null : Number(value),
        entry_fee: event.entry_fee,
        description: event.description,
        format: event.format,
        status: event.status,
        image_url: event.image_url,
        pdf_url: event.pdf_url,
      }),
      'Capacity saved'
    )
    setSaving(false)
    if (!ok) setValue(current)
  }

  const step = (d: number) => setValue(v => String(Math.max(0, (Number(v) || 0) + d)))

  return (
    <div className="flex items-center gap-3">
      <label htmlFor="capacity" className="text-[15px] font-medium">
        Capacity
      </label>
      <div className="flex items-center rounded-xl border border-input bg-pitch-800">
        <button type="button" onClick={() => step(-1)} className="flex size-11 items-center justify-center text-lg text-muted-foreground hover:text-foreground" aria-label="Decrease capacity">
          −
        </button>
        <input
          id="capacity"
          type="number"
          inputMode="numeric"
          min={0}
          value={value}
          onChange={e => setValue(e.target.value)}
          className="h-11 w-14 bg-transparent text-center text-base tabular outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button type="button" onClick={() => step(1)} className="flex size-11 items-center justify-center text-lg text-muted-foreground hover:text-foreground" aria-label="Increase capacity">
          +
        </button>
      </div>
      {dirty && (
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      )}
    </div>
  )
}

// ───────────────────────── Event details editor ─────────────────────────

function EventDetails({ event, run, open, onClose }: { event: AdminEvent; run: AdminCtx['run']; open: boolean; onClose: () => void }) {
  const [form, setForm] = useState<AdminEvent | null>(null)
  const [saving, setSaving] = useState(false)
  const f = open ? form ?? event : null

  const save = async () => {
    if (!f) return
    setSaving(true)
    const ok = await run(
      updateEvent(event.id, {
        name: f.name,
        date: f.date,
        time: f.time,
        location: f.location,
        max_players: f.max_players,
        entry_fee: f.entry_fee,
        description: f.description,
        format: f.format,
        status: f.status,
        image_url: f.image_url,
        pdf_url: f.pdf_url,
        featured: !!f.featured,
        subtitle: f.subtitle,
      }),
      'Event saved'
    )
    setSaving(false)
    if (ok) {
      setForm(null)
      onClose()
    }
  }

  const set = <K extends keyof AdminEvent>(k: K, v: AdminEvent[K]) => setForm(prev => ({ ...(prev ?? event), [k]: v }))
  const formats = f?.format && !FORMATS.includes(f.format) ? [f.format, ...FORMATS] : FORMATS
  const close = () => {
    setForm(null)
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title="Edit event"
      tall
      footer={
        <PrimaryButton className="w-full" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </PrimaryButton>
      }
    >
      {f && (
        <div className="space-y-3 px-5 pb-4">
          <label className="block">
            <span className={labelCls}>Name</span>
            <input className={inputCls} style={C.input} value={f.name} onChange={e => set('name', e.target.value)} />
          </label>
          <label className="block">
            <span className={labelCls}>Subtitle (line under the title, optional)</span>
            <input className={inputCls} style={C.input} value={f.subtitle ?? ''} placeholder="e.g. Court Americano" onChange={e => set('subtitle', e.target.value)} />
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px]">
            <Checkbox checked={!!f.featured} onCheckedChange={v => set('featured', v === true)} />
            Featured (shows the orange “FEATURED” tag)
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>Date</span>
              <input type="date" className={inputCls} style={C.input} value={f.date ?? ''} onChange={e => set('date', e.target.value)} />
            </label>
            <label className="block">
              <span className={labelCls}>Time</span>
              <input className={inputCls} style={C.input} value={f.time ?? ''} placeholder="17:00" onChange={e => set('time', e.target.value)} />
            </label>
          </div>
          <label className="block">
            <span className={labelCls}>Location</span>
            <input className={inputCls} style={C.input} value={f.location ?? ''} onChange={e => set('location', e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>Max players</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                className={inputCls}
                style={C.input}
                value={f.max_players ?? ''}
                onChange={e => set('max_players', e.target.value === '' ? null : Number(e.target.value))}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Entry fee (€)</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                className={inputCls}
                style={C.input}
                value={f.entry_fee ?? ''}
                onChange={e => set('entry_fee', e.target.value === '' ? null : Number(e.target.value))}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>Format</span>
              <select className={inputCls} style={C.input} value={f.format ?? ''} onChange={e => set('format', e.target.value || null)}>
                <option value="">—</option>
                {formats.map(x => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelCls}>Status</span>
              <select className={inputCls} style={C.input} value={f.status} onChange={e => set('status', e.target.value)}>
                {STATUSES.map(s => (
                  <option key={s} value={s}>
                    {s[0].toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className={labelCls}>Description</span>
            <textarea rows={4} className={`${inputCls} resize-y`} style={C.input} value={f.description ?? ''} onChange={e => set('description', e.target.value)} />
          </label>
          <label className="block">
            <span className={labelCls}>Logo / image URL</span>
            <input type="url" className={inputCls} style={C.input} value={f.image_url ?? ''} onChange={e => set('image_url', e.target.value)} />
          </label>
          {f.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.image_url} alt="" className="size-20 rounded-full border-2 border-white/80 bg-white object-contain" />
          )}
          <label className="block">
            <span className={labelCls}>Info PDF URL</span>
            <input type="url" className={inputCls} style={C.input} value={f.pdf_url ?? ''} onChange={e => set('pdf_url', e.target.value)} />
          </label>
        </div>
      )}
    </Sheet>
  )
}

// ───────────────────────── Fixtures ─────────────────────────

function FixturesCard({ event, hasFixtures }: { event: AdminEvent; hasFixtures: boolean }) {
  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl border border-border-strong text-muted-foreground">
          <Network className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-semibold leading-tight">Fixtures</h2>
          <p className="text-sm text-muted-foreground">
            {event.format === 'Team' ? 'Group stage + knockout' : event.format === 'Team Americano' ? 'Round robin + placement finals' : 'Americano rounds + court finals'}
          </p>
        </div>
      </div>
      <p className="mt-4 text-[15px] text-muted-foreground">
        {hasFixtures ? 'Fixtures have been generated. Enter scores and manage rounds in the fixtures manager.' : 'Generate and score the fixtures for this event in the fixtures manager.'}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild>
          <Link href={`/admin/tournament?event=${event.id}`}>
            <Network />
            {hasFixtures ? 'Open fixtures' : 'Generate fixtures'}
          </Link>
        </Button>
        {event.pdf_url && (
          <Button asChild variant="secondary">
            <a href={event.pdf_url} target="_blank" rel="noopener noreferrer">
              <Download />
              Download PDF
            </a>
          </Button>
        )}
      </div>
    </Card>
  )
}

// ───────────────────────── Participants ─────────────────────────

function ParticipantsSection({
  ctx,
  event,
  registrations,
  teams,
}: {
  ctx: AdminCtx
  event: AdminEvent
  registrations: AdminRegistration[]
  teams: AdminTeam[]
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [sendEmail, setSendEmail] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [q, setQ] = useState('')

  const teamOf = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of teams) {
      m.set(t.captain_id, t.team_name)
      if (t.partner_id) m.set(t.partner_id, t.team_name)
    }
    return m
  }, [teams])

  const disabled = useMemo(() => new Map(registrations.map(r => [r.user_id, 'Registered'])), [registrations])

  const visible = useMemo(() => {
    const k = searchKey(q.trim())
    if (!k) return registrations
    return registrations.filter(r => {
      const p = ctx.profileMap.get(r.user_id)
      return searchKey(`${fullName(p)} ${p?.player_code ?? ''} ${p?.email ?? ''}`).includes(k)
    })
  }, [q, registrations, ctx.profileMap])

  const openPicker = async () => {
    if (!(await ctx.confirmFixtures())) return
    setSendEmail(false)
    setPickerOpen(true)
  }

  const add = async (ids: string[]) => {
    setBusy('add')
    const ok = await ctx.run(addRegistrations(ctx.eventId, ids, sendEmail), d =>
      `Added ${d?.added ?? 0} player${d?.added === 1 ? '' : 's'}${sendEmail ? ` · ${d?.emailed ?? 0} email(s) sent` : ''}`
    )
    setBusy(null)
    if (ok) setPickerOpen(false)
  }

  const remove = async (r: AdminRegistration) => {
    const name = fullName(ctx.profileMap.get(r.user_id))
    const { ok } = await ctx.ask({
      title: `Remove ${name}?`,
      message: (
        <>
          <p>Their registration for {event.name} will be deleted. No email is sent.</p>
          {ctx.fixtureNote}
        </>
      ),
      confirmLabel: 'Remove',
      destructive: true,
    })
    if (!ok) return
    setBusy(r.id)
    await ctx.run(removeRegistration(ctx.eventId, r.id), `${name} removed`)
    setBusy(null)
  }

  const changeStatus = async (r: AdminRegistration, status: string) => {
    setBusy(r.id)
    await ctx.run(setRegistrationStatus(ctx.eventId, r.id, status), 'Status updated')
    setBusy(null)
  }

  const statusSelect = (r: AdminRegistration, className?: string) => {
    const statusOptions = ['approved', 'pending'].includes(r.status) ? ['approved', 'pending'] : [r.status, 'approved', 'pending']
    return (
      <select
        value={r.status}
        disabled={busy === r.id}
        onChange={e => changeStatus(r, e.target.value)}
        className={cn('min-h-11 rounded-xl border border-input bg-pitch-800 px-3 text-base outline-none focus-visible:border-primary-text', className)}
        aria-label={`Registration status for ${fullName(ctx.profileMap.get(r.user_id))}`}
      >
        {statusOptions.map(s => (
          <option key={s} value={s}>
            {s[0].toUpperCase() + s.slice(1)}
          </option>
        ))}
      </select>
    )
  }

  return (
    <Card className="p-3 md:p-4">
      <div className="flex gap-2">
        <SearchInput value={q} onChange={e => setQ(e.target.value)} placeholder="Search players…" aria-label="Search participants" className="flex-1" />
        <Button size="lg" onClick={openPicker} className="shrink-0">
          <Plus />
          <span className="max-sm:sr-only">Add player</span>
        </Button>
      </div>

      {registrations.length === 0 ? (
        <EmptyState className="mt-3" icon={Users} title="No players registered yet" description="Add players manually or wait for registrations." />
      ) : visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No players match “{q}”.</p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="mt-3 hidden overflow-x-auto rounded-xl border border-border md:block">
            <table className="w-full text-[15px]">
              <caption className="sr-only">Participants ({registrations.length})</caption>
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-subtle">
                  <th scope="col" className="px-4 py-3 font-medium">Player</th>
                  <th scope="col" className="whitespace-nowrap px-3 py-3 font-medium">Player code</th>
                  <th scope="col" className="px-3 py-3 font-medium">Skill</th>
                  <th scope="col" className="px-3 py-3 font-medium">Rating</th>
                  <th scope="col" className="px-3 py-3 font-medium">Status</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map(r => {
                  const p = ctx.profileMap.get(r.user_id)
                  const team = teamOf.get(r.user_id)
                  return (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-4 py-2.5">
                        <div className="flex max-w-[15rem] items-center gap-3 xl:max-w-[18rem]">
                          <Avatar profile={p} size={36} />
                          <div className="min-w-0">
                            <p className="truncate font-display text-[17px] font-semibold leading-tight">{fullName(p)}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {p?.email || 'no email'}
                              {team && <span className="text-primary-text"> · {team}</span>}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 tabular text-muted-foreground">{p?.player_code || '—'}</td>
                      <td className="px-3 py-2.5"><SkillBadge level={p?.skill_level ?? null} /></td>
                      <td className="px-3 py-2.5 font-display text-base font-semibold tabular">{p?.skill_score || '—'}</td>
                      <td className="px-3 py-2.5">{statusSelect(r, 'min-h-10 text-sm')}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="size-10" onClick={() => ctx.editProfile(r.user_id)} disabled={!p} aria-label={`Edit ${fullName(p)}`}>
                            <Pencil />
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => remove(r)} disabled={busy === r.id}>
                            <Trash2 />
                            {busy === r.id ? '…' : 'Remove'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Phone list */}
          <ul className="mt-3 space-y-2 md:hidden">
            {visible.map(r => {
              const p = ctx.profileMap.get(r.user_id)
              const team = teamOf.get(r.user_id)
              return (
                <li key={r.id} className="rounded-xl border border-border bg-pitch-850 p-3">
                  <div className="flex items-center gap-3">
                    <Avatar profile={p} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-[17px] font-semibold leading-tight">{fullName(p)}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p?.player_code || 'no code'}
                        {team && <span className="text-primary-text"> · {team}</span>}
                      </p>
                    </div>
                    <SkillBadge level={p?.skill_level ?? null} />
                    <span className="w-10 text-right font-display text-base font-semibold tabular">{p?.skill_score || '—'}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    {statusSelect(r, 'flex-1 min-w-0')}
                    <Button variant="ghost" size="icon" onClick={() => ctx.editProfile(r.user_id)} disabled={!p} aria-label={`Edit ${fullName(p)}`}>
                      <Pencil />
                    </Button>
                    <Button variant="danger" size="icon" onClick={() => remove(r)} disabled={busy === r.id} aria-label={`Remove ${fullName(p)}`}>
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <ProfilePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Add player"
        profiles={ctx.profiles}
        multiple
        disabled={disabled}
        busy={busy === 'add'}
        confirmLabel={n => (n === 0 ? 'Select players' : n === 1 ? 'Add selected player' : `Add ${n} selected players`)}
        footerExtra={selected => (
          <>
            {selected.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {selected.length} player{selected.length === 1 ? '' : 's'} selected
              </p>
            )}
            {ctx.capacityNote(isTeamFormat(event.format) ? 0 : selected.length)}
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <Checkbox checked={sendEmail} onCheckedChange={v => setSendEmail(v === true)} />
              Send confirmation email
            </label>
          </>
        )}
        onConfirm={add}
      />
    </Card>
  )
}
