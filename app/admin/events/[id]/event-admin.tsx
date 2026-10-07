'use client'

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { ActionResult } from './actions'
import { addRegistrations, removeRegistration, setRegistrationOpen, setRegistrationStatus, updateEvent, updateProfile } from './actions'
import ProfilePicker from './profile-picker'
import TeamsSection from './teams-section'
import type { AdminEvent, AdminProfile, AdminRegistration, AdminTeam } from './types'
import { fullName, isTeamFormat } from './types'
import { Avatar, C, GhostButton, LevelBadge, PrimaryButton, Section, Sheet, inputCls, labelCls, useConfirm, useToasts } from './ui'

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
    <p className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ backgroundColor: 'rgba(234,179,8,0.15)', color: '#facc15' }}>
      ⚠ This tournament already has generated rounds/matches. Changing participants or teams may make existing fixtures inconsistent. Fixtures and scores are not changed automatically.
    </p>
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
      <p className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ backgroundColor: 'rgba(234,179,8,0.15)', color: '#facc15' }}>
        ⚠ This exceeds max players: {filled + adding} / {capacity}. Admin adds are still allowed.
      </p>
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

  return (
    <main className="min-h-dvh px-4 py-5 sm:p-10" style={{ backgroundColor: C.bg }}>
      {toastView}
      {dialog}
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-4">
          <a href="/admin" className="min-h-11 inline-flex items-center text-sm font-semibold text-white/70">
            ← Admin
          </a>
          <a href={`/tournaments/${event.id}`} className="min-h-11 inline-flex items-center text-sm font-semibold" style={{ color: C.orange }}>
            Public page ↗
          </a>
        </div>

        <h1 className="text-2xl font-bold text-white mb-1 break-words">{event.name}</h1>
        <p className="text-sm text-white/60 mb-4">
          {event.date}
          {event.time ? ` · ${event.time}` : ''}
          {event.format ? ` · ${event.format}` : ''} · {filled}
          {capacity > 0 ? ` / ${capacity}` : ''} players
        </p>

        {fixtureNote && <div className="mb-4">{fixtureNote}</div>}

        <RegistrationToggle event={event} run={run} ask={ask} />

        <EventDetails event={event} run={run} />

        <ParticipantsSection ctx={ctx} event={event} registrations={registrations} teams={teams} />

        {teamFormat && <TeamsSection ctx={ctx} registrations={registrations} teams={teams} />}
      </div>

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
          <div className="px-4 pb-4 space-y-3">
            <p className="text-xs text-white/50 break-all">{profileMap.get(profileEdit.id)?.email}</p>
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
    <button
      type="button"
      onClick={toggle}
      disabled={saving}
      role="switch"
      aria-checked={open}
      className="w-full flex items-center justify-between gap-3 rounded-2xl px-4 py-3 mb-4 min-h-16 text-left disabled:opacity-60"
      style={{
        backgroundColor: open ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
        border: `1px solid ${open ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
      }}
    >
      <span>
        <span className="block text-sm font-bold" style={{ color: open ? '#22c55e' : '#f87171' }}>
          {open ? 'Registrations open' : 'Registrations closed'}
        </span>
        <span className="block text-xs text-white/50">{saving ? 'Saving…' : 'Tap to ' + (open ? 'close' : 'open')}</span>
      </span>
      <span className="relative w-14 h-8 rounded-full shrink-0 transition" style={{ backgroundColor: open ? '#22c55e' : 'rgba(255,255,255,0.2)' }}>
        <span className="absolute top-1 w-6 h-6 rounded-full bg-white transition-all" style={{ left: open ? 28 : 4 }} />
      </span>
    </button>
  )
}

// ───────────────────────── Event details ─────────────────────────

function EventDetails({ event, run }: { event: AdminEvent; run: AdminCtx['run'] }) {
  const [form, setForm] = useState<AdminEvent | null>(null)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!form) return
    setSaving(true)
    const ok = await run(
      updateEvent(event.id, {
        name: form.name,
        date: form.date,
        time: form.time,
        location: form.location,
        max_players: form.max_players,
        entry_fee: form.entry_fee,
        description: form.description,
        format: form.format,
        status: form.status,
        image_url: form.image_url,
        pdf_url: form.pdf_url,
      }),
      'Event saved'
    )
    setSaving(false)
    if (ok) setForm(null)
  }

  const set = <K extends keyof AdminEvent>(k: K, v: AdminEvent[K]) => setForm(f => (f ? { ...f, [k]: v } : f))
  const formats = form?.format && !FORMATS.includes(form.format) ? [form.format, ...FORMATS] : FORMATS

  return (
    <Section title="Event details" action={<GhostButton onClick={() => setForm({ ...event })}>Edit</GhostButton>}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {[
          ['Location', event.location],
          ['Status', event.status],
          ['Max players', event.max_players],
          ['Entry fee', event.entry_fee != null ? `€${event.entry_fee}` : null],
        ].map(([k, v]) => (
          <div key={k as string} className="min-w-0">
            <dt className="text-[11px] uppercase tracking-wide text-white/40 font-semibold">{k}</dt>
            <dd className="text-white truncate">{v ?? '—'}</dd>
          </div>
        ))}
      </dl>

      <Sheet
        open={!!form}
        onClose={() => setForm(null)}
        title="Edit event"
        tall
        footer={
          <PrimaryButton className="w-full" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </PrimaryButton>
        }
      >
        {form && (
          <div className="px-4 pb-4 space-y-3">
            <label className="block">
              <span className={labelCls}>Name</span>
              <input className={inputCls} style={C.input} value={form.name} onChange={e => set('name', e.target.value)} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={labelCls}>Date</span>
                <input type="date" className={inputCls} style={C.input} value={form.date ?? ''} onChange={e => set('date', e.target.value)} />
              </label>
              <label className="block">
                <span className={labelCls}>Time</span>
                <input className={inputCls} style={C.input} value={form.time ?? ''} placeholder="17:00" onChange={e => set('time', e.target.value)} />
              </label>
            </div>
            <label className="block">
              <span className={labelCls}>Location</span>
              <input className={inputCls} style={C.input} value={form.location ?? ''} onChange={e => set('location', e.target.value)} />
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
                  value={form.max_players ?? ''}
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
                  value={form.entry_fee ?? ''}
                  onChange={e => set('entry_fee', e.target.value === '' ? null : Number(e.target.value))}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={labelCls}>Format</span>
                <select className={inputCls} style={C.input} value={form.format ?? ''} onChange={e => set('format', e.target.value || null)}>
                  <option value="">—</option>
                  {formats.map(f => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelCls}>Status</span>
                <select className={inputCls} style={C.input} value={form.status} onChange={e => set('status', e.target.value)}>
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
              <textarea rows={4} className={`${inputCls} resize-y`} style={C.input} value={form.description ?? ''} onChange={e => set('description', e.target.value)} />
            </label>
            <label className="block">
              <span className={labelCls}>Image URL</span>
              <input type="url" className={inputCls} style={C.input} value={form.image_url ?? ''} onChange={e => set('image_url', e.target.value)} />
            </label>
            {form.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.image_url} alt="" className="w-full max-h-40 object-cover rounded-xl" />
            )}
            <label className="block">
              <span className={labelCls}>Info PDF URL</span>
              <input type="url" className={inputCls} style={C.input} value={form.pdf_url ?? ''} onChange={e => set('pdf_url', e.target.value)} />
            </label>
          </div>
        )}
      </Sheet>
    </Section>
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

  const teamOf = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of teams) {
      m.set(t.captain_id, t.team_name)
      if (t.partner_id) m.set(t.partner_id, t.team_name)
    }
    return m
  }, [teams])

  const disabled = useMemo(() => new Map(registrations.map(r => [r.user_id, 'Registered'])), [registrations])

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

  return (
    <Section title="Players" count={registrations.length} action={<PrimaryButton onClick={openPicker} className="w-12 text-2xl leading-none" aria-label="Add players">+</PrimaryButton>}>
      {registrations.length === 0 ? (
        <p className="text-sm text-white/50 py-2">No players registered yet.</p>
      ) : (
        <ul className="divide-y divide-white/5">
          {registrations.map(r => {
            const p = ctx.profileMap.get(r.user_id)
            const team = teamOf.get(r.user_id)
            const statusOptions = ['approved', 'pending'].includes(r.status) ? ['approved', 'pending'] : [r.status, 'approved', 'pending']
            return (
              <li key={r.id} className="py-3">
                <div className="flex items-start gap-3">
                  <Avatar profile={p} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white break-words">{fullName(p)}</p>
                    <p className="text-xs text-white/50 break-all">{p?.email || 'no email'}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-[11px] font-mono text-white/50">{p?.player_code || 'no code'}</span>
                      <LevelBadge level={p?.skill_level ?? null} />
                      {team && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(255,107,53,0.15)', color: C.orange }}>
                          {team}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 pl-[52px]">
                  <select
                    value={r.status}
                    disabled={busy === r.id}
                    onChange={e => changeStatus(r, e.target.value)}
                    className="min-h-11 flex-1 min-w-0 px-2 rounded-xl text-sm text-white outline-none"
                    style={C.input}
                    aria-label="Registration status"
                  >
                    {statusOptions.map(s => (
                      <option key={s} value={s}>
                        {s[0].toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                  <GhostButton onClick={() => ctx.editProfile(r.user_id)} disabled={!p}>
                    Edit
                  </GhostButton>
                  <GhostButton danger onClick={() => remove(r)} disabled={busy === r.id}>
                    {busy === r.id ? '…' : 'Remove'}
                  </GhostButton>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <ProfilePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Add players"
        profiles={ctx.profiles}
        multiple
        disabled={disabled}
        busy={busy === 'add'}
        confirmLabel={n => (n === 0 ? 'Select players' : `Add ${n} player${n === 1 ? '' : 's'}`)}
        footerExtra={selected => (
          <>
            {ctx.capacityNote(isTeamFormat(event.format) ? 0 : selected.length)}
            <label className="flex items-center gap-3 text-sm text-white/80 min-h-11 cursor-pointer">
              <input type="checkbox" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)} className="w-5 h-5 accent-[#ff6b35]" />
              Send confirmation email
            </label>
          </>
        )}
        onConfirm={add}
      />
    </Section>
  )
}
