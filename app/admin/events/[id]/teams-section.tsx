'use client'

import { useMemo, useState } from 'react'
import type { TeamSlot } from './actions'
import { createTeam, deleteTeam, swapPlayers, updateTeam } from './actions'
import type { AdminCtx } from './event-admin'
import ProfilePicker from './profile-picker'
import type { AdminRegistration, AdminTeam } from './types'
import { fullName } from './types'
import { Avatar, C, GhostButton, PrimaryButton, Section, Sheet, inputCls, labelCls } from './ui'

type TeamStatus = AdminTeam['status']

const STATUS_LABEL: Record<TeamStatus, { text: string; bg: string; color: string }> = {
  pending_partner: { text: 'Waiting for partner', bg: 'rgba(234,179,8,0.15)', color: '#eab308' },
  pending_approval: { text: 'Pending approval', bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
  approved: { text: 'Approved', bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
  rejected: { text: 'Rejected', bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
}

type Editor = {
  teamId: string | null // null → creating
  captainId: string | null
  partnerId: string | null
  name: string
  nameTouched: boolean
  status: TeamStatus
  sendEmail: boolean
}

export default function TeamsSection({ ctx, registrations, teams }: { ctx: AdminCtx; registrations: AdminRegistration[]; teams: AdminTeam[] }) {
  const [editor, setEditor] = useState<Editor | null>(null)
  const [pickSlot, setPickSlot] = useState<TeamSlot | null>(null)
  const [saving, setSaving] = useState(false)
  const [swapOpen, setSwapOpen] = useState(false)
  const [swapA, setSwapA] = useState('')
  const [swapB, setSwapB] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const firstName = (id: string | null) => (id ? ctx.profileMap.get(id)?.first_name?.trim() || fullName(ctx.profileMap.get(id)).split(' ')[0] : '')
  const autoName = (c: string | null, p: string | null) => [firstName(c), firstName(p)].filter(Boolean).join(' & ')

  const teamOfPlayer = useMemo(() => {
    const m = new Map<string, AdminTeam>()
    for (const t of teams) {
      m.set(t.captain_id, t)
      if (t.partner_id) m.set(t.partner_id, t)
    }
    return m
  }, [teams])

  const unassigned = registrations.filter(r => !teamOfPlayer.has(r.user_id))

  // ───── Editor ─────
  const openCreate = async (captainId: string | null = null) => {
    if (!(await ctx.confirmFixtures())) return
    setEditor({ teamId: null, captainId, partnerId: null, name: autoName(captainId, null), nameTouched: false, status: 'approved', sendEmail: false })
  }

  const openEdit = (t: AdminTeam) =>
    setEditor({ teamId: t.id, captainId: t.captain_id, partnerId: t.partner_id, name: t.team_name, nameTouched: true, status: t.status, sendEmail: false })

  const pickerDisabled = useMemo(() => {
    const m = new Map<string, string>()
    if (!editor) return m
    for (const t of teams) {
      if (t.id === editor.teamId) continue
      m.set(t.captain_id, `In ${t.team_name}`)
      if (t.partner_id) m.set(t.partner_id, `In ${t.team_name}`)
    }
    if (pickSlot === 'captain' && editor.partnerId) m.set(editor.partnerId, 'Partner')
    if (pickSlot === 'partner' && editor.captainId) m.set(editor.captainId, 'Captain')
    return m
  }, [teams, editor, pickSlot])

  const onPick = (ids: string[]) => {
    const id = ids[0]
    if (!editor || !id || !pickSlot) return
    const next = { ...editor, [pickSlot === 'captain' ? 'captainId' : 'partnerId']: id }
    if (!next.nameTouched) next.name = autoName(next.captainId, next.partnerId)
    setEditor(next)
    setPickSlot(null)
  }

  const saveEditor = async () => {
    if (!editor) return
    if (!editor.captainId || !editor.partnerId) {
      await ctx.ask({ title: 'Pick both players', message: 'A team needs a captain and a partner.', confirmLabel: 'OK' })
      return
    }
    const original = editor.teamId ? teams.find(t => t.id === editor.teamId) : null
    const playersChanged = !original || original.captain_id !== editor.captainId || original.partner_id !== editor.partnerId
    if (original && playersChanged && !(await ctx.confirmFixtures())) return

    setSaving(true)
    const ok = editor.teamId
      ? await ctx.run(
          updateTeam(ctx.eventId, editor.teamId, { team_name: editor.name, captain_id: editor.captainId, partner_id: editor.partnerId, status: editor.status }),
          'Team updated'
        )
      : await ctx.run(
          createTeam(ctx.eventId, { captain_id: editor.captainId, partner_id: editor.partnerId, team_name: editor.name, sendEmail: editor.sendEmail }),
          d => `Team created${editor.sendEmail ? ` · ${d?.emailed ?? 0} email(s) sent` : ''}`
        )
    setSaving(false)
    if (ok) setEditor(null)
  }

  // ───── Delete ─────
  const remove = async (t: AdminTeam) => {
    const { ok, checked } = await ctx.ask({
      title: `Delete "${t.team_name}"?`,
      message: (
        <>
          <p>The team will be deleted. No email is sent.</p>
          {ctx.fixtureNote}
        </>
      ),
      checkbox: "Also remove both players' individual registrations for this event",
      confirmLabel: 'Delete team',
      destructive: true,
    })
    if (!ok) return
    setBusy(t.id)
    await ctx.run(deleteTeam(ctx.eventId, t.id, checked), `"${t.team_name}" deleted`)
    setBusy(null)
  }

  // ───── Swap ─────
  const slotOptions = teams.flatMap(t =>
    (['captain', 'partner'] as TeamSlot[])
      .map(slot => ({ t, slot, playerId: slot === 'captain' ? t.captain_id : t.partner_id }))
      .filter(o => !!o.playerId)
      .map(o => ({ value: `${o.t.id}:${o.slot}`, teamId: o.t.id, label: `${o.t.team_name} — ${fullName(ctx.profileMap.get(o.playerId!))}` }))
  )
  const parseSlot = (v: string) => {
    const [teamId, slot] = v.split(':')
    return { teamId, slot: slot as TeamSlot }
  }
  const openSwap = async () => {
    if (!(await ctx.confirmFixtures())) return
    setSwapA('')
    setSwapB('')
    setSwapOpen(true)
  }
  const doSwap = async () => {
    if (!swapA || !swapB) return
    setSaving(true)
    const ok = await ctx.run(swapPlayers(ctx.eventId, parseSlot(swapA), parseSlot(swapB)), 'Players swapped')
    setSaving(false)
    if (ok) setSwapOpen(false)
  }
  const swapATeam = swapA ? parseSlot(swapA).teamId : null

  const editorPlayer = (slot: TeamSlot) => {
    const id = slot === 'captain' ? editor?.captainId : editor?.partnerId
    const p = id ? ctx.profileMap.get(id) : null
    return (
      <div>
        <span className={labelCls}>{slot === 'captain' ? 'Captain' : 'Partner'}</span>
        <button type="button" onClick={() => setPickSlot(slot)} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl min-h-14 text-left" style={C.input}>
          {p ? (
            <>
              <Avatar profile={p} size={32} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate">{fullName(p)}</p>
                <p className="text-[11px] text-white/50 truncate">
                  {p.player_code || 'no code'} · {p.email || 'no email'}
                </p>
              </div>
              <span className="text-xs font-semibold shrink-0" style={{ color: C.orange }}>
                Change
              </span>
            </>
          ) : (
            <span className="text-sm font-semibold" style={{ color: C.orange }}>
              + Pick {slot}
            </span>
          )}
        </button>
      </div>
    )
  }

  return (
    <>
      <Section title="Teams" count={teams.length} action={<PrimaryButton onClick={() => openCreate()}>+ Add team</PrimaryButton>}>
        {teams.length >= 2 && (
          <GhostButton onClick={openSwap} className="w-full mb-3">
            ⇄ Swap players between teams
          </GhostButton>
        )}
        {teams.length === 0 ? (
          <p className="text-sm text-white/50 py-2">No teams yet.</p>
        ) : (
          <ul className="space-y-3">
            {teams.map(t => {
              const s = STATUS_LABEL[t.status] ?? STATUS_LABEL.pending_approval
              return (
                <li key={t.id} className="rounded-xl p-3" style={{ backgroundColor: C.bg, border: `1px solid ${C.border}` }}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-bold break-words min-w-0" style={{ color: C.orange }}>
                      {t.team_name}
                    </p>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap shrink-0" style={{ backgroundColor: s.bg, color: s.color }}>
                      {s.text}
                    </span>
                  </div>
                  {[t.captain_id, t.partner_id].map((pid, i) => {
                    const p = pid ? ctx.profileMap.get(pid) : null
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={!p}
                        onClick={() => pid && ctx.editProfile(pid)}
                        className="w-full flex items-center gap-2 py-1.5 text-left min-h-11"
                        aria-label={p ? `Edit profile of ${fullName(p)}` : undefined}
                      >
                        <Avatar profile={p} size={28} />
                        <span className="text-sm text-white truncate flex-1">
                          {p ? fullName(p) : <span className="text-white/40">No {i === 0 ? 'captain' : 'partner'}</span>}
                          {i === 0 && <span className="text-white/40 text-xs"> · captain</span>}
                        </span>
                        {p && <span className="text-[11px] font-mono text-white/40 shrink-0">{p.player_code}</span>}
                      </button>
                    )
                  })}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <GhostButton onClick={() => openEdit(t)}>Edit</GhostButton>
                    <GhostButton danger onClick={() => remove(t)} disabled={busy === t.id}>
                      {busy === t.id ? '…' : 'Delete'}
                    </GhostButton>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      <Section title="Unassigned players" count={unassigned.length}>
        {unassigned.length === 0 ? (
          <p className="text-sm text-white/50 py-2">Every registered player is in a team.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {unassigned.map(r => {
              const p = ctx.profileMap.get(r.user_id)
              return (
                <li key={r.id} className="flex items-center gap-3 py-2">
                  <Avatar profile={p} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">{fullName(p)}</p>
                    <p className="text-[11px] font-mono text-white/40">{p?.player_code || 'no code'}</p>
                  </div>
                  <GhostButton onClick={() => openCreate(r.user_id)} className="shrink-0">
                    Create team
                  </GhostButton>
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      {/* Create / edit team */}
      <Sheet
        open={!!editor && !pickSlot}
        onClose={() => setEditor(null)}
        title={editor?.teamId ? 'Edit team' : 'Add team'}
        footer={
          <PrimaryButton className="w-full" onClick={saveEditor} disabled={saving}>
            {saving ? 'Saving…' : editor?.teamId ? 'Save team' : 'Create team'}
          </PrimaryButton>
        }
      >
        {editor && (
          <div className="px-4 pb-4 space-y-3">
            {editorPlayer('captain')}
            {editorPlayer('partner')}
            <label className="block">
              <span className={labelCls}>Team name</span>
              <input className={inputCls} style={C.input} value={editor.name} onChange={e => setEditor({ ...editor, name: e.target.value, nameTouched: true })} />
            </label>
            {editor.teamId ? (
              <label className="block">
                <span className={labelCls}>Status</span>
                <select className={inputCls} style={C.input} value={editor.status} onChange={e => setEditor({ ...editor, status: e.target.value as TeamStatus })}>
                  {(Object.keys(STATUS_LABEL) as TeamStatus[]).map(s => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s].text}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                {ctx.capacityNote(2)}
                <label className="flex items-center gap-3 text-sm text-white/80 min-h-11 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editor.sendEmail}
                    onChange={e => setEditor({ ...editor, sendEmail: e.target.checked })}
                    className="w-5 h-5 accent-[#ff6b35]"
                  />
                  Send confirmation email
                </label>
              </>
            )}
            <p className="text-xs text-white/40">Players not yet registered for this event are registered automatically.</p>
          </div>
        )}
      </Sheet>

      <ProfilePicker
        open={!!editor && !!pickSlot}
        onClose={() => setPickSlot(null)}
        title={pickSlot === 'captain' ? 'Pick captain' : 'Pick partner'}
        profiles={ctx.profiles}
        disabled={pickerDisabled}
        onConfirm={onPick}
      />

      {/* Swap */}
      <Sheet
        open={swapOpen}
        onClose={() => setSwapOpen(false)}
        title="Swap players"
        footer={
          <PrimaryButton className="w-full" onClick={doSwap} disabled={!swapA || !swapB || saving}>
            {saving ? 'Swapping…' : 'Swap'}
          </PrimaryButton>
        }
      >
        <div className="px-4 pb-4 space-y-3">
          <label className="block">
            <span className={labelCls}>Player 1</span>
            <select className={inputCls} style={C.input} value={swapA} onChange={e => { setSwapA(e.target.value); setSwapB('') }}>
              <option value="">Select…</option>
              {slotOptions.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <p className="text-center text-white/50 text-lg">⇅</p>
          <label className="block">
            <span className={labelCls}>Player 2 (other team)</span>
            <select className={inputCls} style={C.input} value={swapB} onChange={e => setSwapB(e.target.value)} disabled={!swapA}>
              <option value="">Select…</option>
              {slotOptions
                .filter(o => o.teamId !== swapATeam)
                .map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
            </select>
          </label>
          <p className="text-xs text-white/40">Team names are not changed — rename the teams afterwards if needed.</p>
        </div>
      </Sheet>
    </>
  )
}
