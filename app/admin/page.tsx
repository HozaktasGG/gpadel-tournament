'use client'

import { useEffect, useState } from 'react'
import { useAdmin } from './admin-provider'
import { getLevel, getLevelColor } from '@/lib/quiz-questions'
import { createClient } from '@/lib/supabase-client'

type UserRow = {
  id: string
  email: string
  first_name: string
  last_name: string
  phone: string
  skill_score: number | null
  quiz_completed_at: string | null
  player_code: string | null
  event_count: number
  created_at: string
}

type EventReg = {
  id: string
  status: string
  created_at: string
  event_name: string | null
  event_date: string | null
  event_time: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  skill_score: number | null
  skill_level: string | null
}

type TeamMemberEmbed = {
  first_name: string | null
  last_name: string | null
  email: string | null
}

type TeamEventEmbed = {
  name: string | null
}

type TeamReg = {
  id: string
  team_name: string
  status: 'pending_partner' | 'pending_approval' | 'approved' | 'rejected'
  created_at: string
  captain: TeamMemberEmbed | null
  partner: TeamMemberEmbed | null
  event: TeamEventEmbed | null
}

type TeamRegRaw = Omit<TeamReg, 'captain' | 'partner' | 'event'> & {
  captain: TeamMemberEmbed | TeamMemberEmbed[] | null
  partner: TeamMemberEmbed | TeamMemberEmbed[] | null
  event: TeamEventEmbed | TeamEventEmbed[] | null
}

type PendingInvite = {
  id: string
  team_name: string
  status: 'pending_partner' | 'pending_approval'
  created_at: string
  event_name: string | null
}

type PendingInviteRaw = {
  id: string
  team_name: string
  status: 'pending_partner' | 'pending_approval'
  created_at: string
  event: TeamEventEmbed | TeamEventEmbed[] | null
}

function unwrapOne<T>(v: T | T[] | null): T | null {
  if (Array.isArray(v)) return v[0] ?? null
  return v
}

type EventRow = {
  id: string
  name: string
  date: string
  time: string | null
  location: string | null
  max_players: number | null
  entry_fee: number | null
  format: string | null
  description: string | null
  status: string
  pdf_url: string | null
  image_url: string | null
}

type EventFormData = {
  name: string
  date: string
  time: string
  location: string
  max_players: number
  entry_fee: number
  format: string
  description: string
  status: string
}

const EMPTY_EVENT_FORM: EventFormData = {
  name: '',
  date: '',
  time: '17:00',
  location: '',
  max_players: 12,
  entry_fee: 17,
  format: 'Americano',
  description: '',
  status: 'upcoming',
}

export default function AdminPage() {
  const { password } = useAdmin()

  const [users, setUsers] = useState<UserRow[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)

  const [eventRegs, setEventRegs] = useState<EventReg[]>([])
  const [eventRegsLoading, setEventRegsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [events, setEvents] = useState<EventRow[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [eventForm, setEventForm] = useState<EventFormData>(EMPTY_EVENT_FORM)
  const [createMsg, setCreateMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [creating, setCreating] = useState(false)
  const [editingEvent, setEditingEvent] = useState<EventRow | null>(null)
  const [eventActionLoading, setEventActionLoading] = useState<string | null>(null)

  const [teamRegs, setTeamRegs] = useState<TeamReg[]>([])
  const [teamRegsLoading, setTeamRegsLoading] = useState(true)
  const [teamActionLoading, setTeamActionLoading] = useState<string | null>(null)

  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [pendingInvitesLoading, setPendingInvitesLoading] = useState(false)
  const [cancelingInviteId, setCancelingInviteId] = useState<string | null>(null)

  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  const supabaseBrowser = createClient()

  const fetchUsers = async () => {
    setUsersLoading(true)
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const data = await res.json()
    setUsersLoading(false)
    if (res.ok) setUsers(data.data)
  }

  const fetchEventRegs = async () => {
    setEventRegsLoading(true)
    const res = await fetch('/api/admin/event-registrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const data = await res.json()
    setEventRegsLoading(false)
    if (res.ok) setEventRegs(data.data)
  }

  const fetchEvents = async () => {
    setEventsLoading(true)
    const res = await fetch('/api/admin/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const data = await res.json()
    setEventsLoading(false)
    if (res.ok) setEvents(data.data ?? [])
  }

  const fetchTeamRegs = async () => {
    setTeamRegsLoading(true)
    const { data } = await supabaseBrowser
      .from('team_registrations')
      .select(
        'id, team_name, status, created_at, captain:profiles!team_registrations_captain_id_fkey(first_name, last_name, email), partner:profiles!team_registrations_partner_id_fkey(first_name, last_name, email), event:events(name)'
      )
      .order('created_at', { ascending: false })

    const rows = ((data ?? []) as unknown as TeamRegRaw[]).map<TeamReg>(r => ({
      id: r.id,
      team_name: r.team_name,
      status: r.status,
      created_at: r.created_at,
      captain: unwrapOne(r.captain),
      partner: unwrapOne(r.partner),
      event: unwrapOne(r.event),
    }))
    setTeamRegs(rows)
    setTeamRegsLoading(false)
  }

  useEffect(() => {
    if (password) {
      fetchUsers()
      fetchEventRegs()
      fetchEvents()
      fetchTeamRegs()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password])

  useEffect(() => {
    if (!selectedUser) {
      setPendingInvites([])
      return
    }
    let cancelled = false
    const load = async () => {
      setPendingInvitesLoading(true)
      const { data } = await supabaseBrowser
        .from('team_registrations')
        .select('id, team_name, status, created_at, event:events(name)')
        .eq('captain_id', selectedUser.id)
        .in('status', ['pending_partner', 'pending_approval'])
        .order('created_at', { ascending: false })

      if (cancelled) return

      const rows = ((data ?? []) as unknown as PendingInviteRaw[]).map<PendingInvite>(r => ({
        id: r.id,
        team_name: r.team_name,
        status: r.status,
        created_at: r.created_at,
        event_name: unwrapOne(r.event)?.name ?? null,
      }))
      setPendingInvites(rows)
      setPendingInvitesLoading(false)
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser?.id])

  const handleCancelInvite = async (registrationId: string) => {
    if (!confirm('Bu takım davetini geri çekmek istediğinize emin misiniz?')) return
    setCancelingInviteId(registrationId)
    const res = await fetch('/api/team-registration/cancel', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registration_id: registrationId }),
    })
    const data = await res.json().catch(() => ({}))
    setCancelingInviteId(null)
    if (!res.ok) {
      alert(data.error || 'İşlem başarısız.')
      return
    }
    setPendingInvites(prev => prev.filter(p => p.id !== registrationId))
    fetchTeamRegs()
  }

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateMsg(null)
    if (!eventForm.name.trim() || !eventForm.date) {
      setCreateMsg({ type: 'error', text: 'Name and date are required' })
      return
    }
    setCreating(true)

    let pdfUrl: string | null = null
    if (pdfFile) {
      setUploadingPdf(true)
      const safeName = pdfFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${Date.now()}-${safeName}`
      const { error: uploadErr } = await supabaseBrowser.storage
        .from('tournament-docs')
        .upload(path, pdfFile, { contentType: 'application/pdf' })
      setUploadingPdf(false)
      if (uploadErr) {
        setCreating(false)
        setCreateMsg({ type: 'error', text: 'PDF upload failed: ' + uploadErr.message })
        return
      }
      const { data: urlData } = supabaseBrowser.storage
        .from('tournament-docs')
        .getPublicUrl(path)
      pdfUrl = urlData.publicUrl
    }

    let imageUrl: string | null = null
    if (imageFile) {
      setUploadingImage(true)
      const safeName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${Date.now()}-${safeName}`
      const { error: uploadErr } = await supabaseBrowser.storage
        .from('tournament-images')
        .upload(path, imageFile, { contentType: imageFile.type || 'image/jpeg' })
      setUploadingImage(false)
      if (uploadErr) {
        setCreating(false)
        setCreateMsg({ type: 'error', text: 'Image upload failed: ' + uploadErr.message })
        return
      }
      const { data: urlData } = supabaseBrowser.storage
        .from('tournament-images')
        .getPublicUrl(path)
      imageUrl = urlData.publicUrl
    }

    const res = await fetch('/api/admin/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password,
        action: 'create',
        event: {
          name: eventForm.name.trim(),
          date: eventForm.date,
          time: eventForm.time || null,
          location: eventForm.location || null,
          max_players: Number(eventForm.max_players) || null,
          entry_fee: Number(eventForm.entry_fee) || null,
          format: eventForm.format || null,
          description: eventForm.description || null,
          status: eventForm.status,
          pdf_url: pdfUrl,
          image_url: imageUrl,
        },
      }),
    })
    const data = await res.json()
    setCreating(false)
    if (!res.ok) {
      setCreateMsg({ type: 'error', text: data.error ?? 'Failed to create event' })
      return
    }
    setCreateMsg({ type: 'success', text: `Tournament created (id: ${data.data.id})` })
    setEventForm(EMPTY_EVENT_FORM)
    setPdfFile(null)
    setImageFile(null)
    await fetchEvents()
  }

  const handleUpdateEvent = async () => {
    if (!editingEvent) return
    setEventActionLoading(editingEvent.id)
    const res = await fetch('/api/admin/events', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password,
        id: editingEvent.id,
        event: {
          name: editingEvent.name,
          date: editingEvent.date,
          time: editingEvent.time,
          location: editingEvent.location,
          max_players: editingEvent.max_players,
          entry_fee: editingEvent.entry_fee,
          format: editingEvent.format,
          description: editingEvent.description,
          status: editingEvent.status,
        },
      }),
    })
    const data = await res.json()
    setEventActionLoading(null)
    if (!res.ok) {
      alert('Update failed: ' + (data.error ?? 'unknown'))
      return
    }
    setEditingEvent(null)
    await fetchEvents()
  }

  const handleDeleteEvent = async (id: string, name: string) => {
    if (!confirm(`Delete tournament "${name}"? This cannot be undone.`)) return
    setEventActionLoading(id)
    const res = await fetch('/api/admin/events', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, id }),
    })
    const data = await res.json()
    setEventActionLoading(null)
    if (!res.ok) {
      alert('Delete failed: ' + (data.error ?? 'unknown'))
      return
    }
    await fetchEvents()
  }

  const handleApprove = async (id: string) => {
    setActionLoading(id)
    await fetch('/api/admin/event-registrations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, id }),
    })
    await fetchEventRegs()
    setActionLoading(null)
  }

  const handleReject = async (id: string) => {
    setActionLoading(id)
    await fetch('/api/admin/event-registrations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, id }),
    })
    await fetchEventRegs()
    setActionLoading(null)
  }

  const handleTeamApproval = async (id: string, action: 'approve' | 'reject') => {
    setTeamActionLoading(id)
    const res = await fetch('/api/admin/team-approval', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registration_id: id, action }),
    })
    const data = await res.json()
    setTeamActionLoading(null)
    if (!res.ok) {
      alert(data.error || 'İşlem başarısız.')
      return
    }
    await fetchTeamRegs()
  }

  const teamStatusBadge = (status: TeamReg['status']) => {
    const config = {
      pending_partner:  { text: 'Partner Bekleniyor',     bg: 'rgba(234,179,8,0.15)',  color: '#eab308' },
      pending_approval: { text: 'Admin Onayı Bekleniyor', bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
      approved:         { text: 'Onaylandı',              bg: 'rgba(34,197,94,0.15)',  color: '#22c55e' },
      rejected:         { text: 'Reddedildi',             bg: 'rgba(239,68,68,0.15)',  color: '#f87171' },
    }[status]
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap"
        style={{ backgroundColor: config.bg, color: config.color }}
      >
        {config.text}
      </span>
    )
  }

  const approved = eventRegs.filter(r => r.status === 'approved').length
  const pending = eventRegs.filter(r => r.status !== 'approved').length

  return (
    <main className="min-h-screen p-6 sm:p-10" style={{ backgroundColor: '#1a3d2e' }}>
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <img src="/smashpadel_logo.png" alt="Smash Padel" width={48} height={48} className="rounded-full" />
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
          <a
            href="/admin/scan"
            className="flex items-center justify-center gap-2 w-full py-4 rounded-xl text-base font-bold text-white"
            style={{ backgroundColor: '#ff6b35' }}
          >
            <span style={{ fontSize: 20 }}>📷</span>
            Scan QR
          </a>
          <a
            href="/admin/tournament"
            className="flex items-center justify-center gap-2 w-full py-4 rounded-xl text-base font-bold text-white"
            style={{ backgroundColor: '#ff6b35' }}
          >
            <span style={{ fontSize: 20 }}>🎾</span>
            Tournament Manager
          </a>
        </div>

        {/* ── CREATE NEW TOURNAMENT ── */}
        <section
          className="rounded-2xl p-6 mb-8"
          style={{ backgroundColor: '#0f2a1f', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <h2 className="text-lg font-bold text-white mb-5">Create New Tournament</h2>
          <form onSubmit={handleCreateEvent} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="block text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5">Tournament Name</span>
                <input
                  type="text"
                  required
                  value={eventForm.name}
                  onChange={e => setEventForm({ ...eventForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                  style={{ backgroundColor: '#1a3d2e', border: '1px solid rgba(255,255,255,0.1)' }}
                  placeholder="e.g. SmashTorino #5"
                />
              </label>

              <label className="block">
                <span className="block text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5">Date</span>
                <input
                  type="date"
                  required
                  value={eventForm.date}
                  onChange={e => setEventForm({ ...eventForm, date: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                  style={{ backgroundColor: '#1a3d2e', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </label>

              <label className="block">
                <span className="block text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5">Time</span>
                <input
                  type="time"
                  value={eventForm.time}
                  onChange={e => setEventForm({ ...eventForm, time: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                  style={{ backgroundColor: '#1a3d2e', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </label>

              <label className="block">
                <span className="block text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5">Location</span>
                <input
                  type="text"
                  value={eventForm.location}
                  onChange={e => setEventForm({ ...eventForm, location: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                  style={{ backgroundColor: '#1a3d2e', border: '1px solid rgba(255,255,255,0.1)' }}
                  placeholder="e.g. GPadel Cenisia"
                />
              </label>

              <label className="block">
                <span className="block text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5">Max Players</span>
                <input
                  type="number"
                  min={1}
                  value={eventForm.max_players}
                  onChange={e => setEventForm({ ...eventForm, max_players: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                  style={{ backgroundColor: '#1a3d2e', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </label>

              <label className="block">
                <span className="block text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5">Entry Fee (€)</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={eventForm.entry_fee}
                  onChange={e => setEventForm({ ...eventForm, entry_fee: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                  style={{ backgroundColor: '#1a3d2e', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </label>

              <label className="block">
                <span className="block text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5">Format</span>
                <select
                  value={eventForm.format}
                  onChange={e => setEventForm({ ...eventForm, format: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                  style={{ backgroundColor: '#1a3d2e', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <option value="Americano">Americano</option>
                  <option value="Round Robin">Round Robin</option>
                  <option value="Elimination">Elimination</option>
                  <option value="Team">Team</option>
                </select>
              </label>

              <label className="block">
                <span className="block text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5">Status</span>
                <select
                  value={eventForm.status}
                  onChange={e => setEventForm({ ...eventForm, status: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                  style={{ backgroundColor: '#1a3d2e', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
            </div>

            <label className="block">
              <span className="block text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5">Description</span>
              <textarea
                value={eventForm.description}
                onChange={e => setEventForm({ ...eventForm, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none resize-y"
                style={{ backgroundColor: '#1a3d2e', border: '1px solid rgba(255,255,255,0.1)' }}
                placeholder="Optional description for participants"
              />
            </label>

            <label className="block">
              <span className="block text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5">Tournament Info PDF (optional)</span>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={e => setPdfFile(e.target.files?.[0] ?? null)}
                className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-[#ff6b35] file:text-white file:text-xs file:font-semibold file:cursor-pointer"
                style={{ backgroundColor: '#1a3d2e', border: '1px solid rgba(255,255,255,0.1)' }}
              />
              {pdfFile && (
                <p className="text-gray-400 text-xs mt-1.5">
                  {pdfFile.name}
                  {' · '}
                  {(pdfFile.size / 1024).toFixed(0)} KB
                </p>
              )}
            </label>

            <label className="block">
              <span className="block text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5">Tournament Image (optional)</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={e => setImageFile(e.target.files?.[0] ?? null)}
                className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-[#ff6b35] file:text-white file:text-xs file:font-semibold file:cursor-pointer"
                style={{ backgroundColor: '#1a3d2e', border: '1px solid rgba(255,255,255,0.1)' }}
              />
              {imageFile && (
                <div className="mt-2 flex items-center gap-3">
                  <img
                    src={URL.createObjectURL(imageFile)}
                    alt={imageFile.name}
                    className="w-16 h-16 object-cover rounded-lg"
                    style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                  <p className="text-gray-400 text-xs">
                    {imageFile.name}
                    {' · '}
                    {(imageFile.size / 1024).toFixed(0)} KB
                  </p>
                </div>
              )}
            </label>

            {createMsg && (
              <div
                className="px-4 py-2.5 rounded-lg text-sm font-semibold"
                style={
                  createMsg.type === 'success'
                    ? { backgroundColor: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }
                    : { backgroundColor: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }
                }
              >
                {createMsg.text}
              </div>
            )}

            <button
              type="submit"
              disabled={creating}
              className="w-full sm:w-auto px-6 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
              style={{ backgroundColor: '#ff6b35' }}
            >
              {creating
                ? uploadingImage
                  ? 'Uploading image...'
                  : uploadingPdf
                    ? 'Uploading PDF...'
                    : 'Creating...'
                : 'Create Tournament'}
            </button>
          </form>
        </section>

        {/* ── ALL EVENTS ── */}
        <section
          className="rounded-2xl p-6 mb-8"
          style={{ backgroundColor: '#0f2a1f', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <h2 className="text-lg font-bold text-white mb-4">
            All Tournaments
            {!eventsLoading && (
              <span className="ml-2 text-sm font-normal text-white/50">({events.length})</span>
            )}
          </h2>

          {eventsLoading ? (
            <p className="text-sm text-white/50">Loading...</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-white/50">No tournaments yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {['Name', 'Date', 'Status', 'Max Players', 'Actions'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-white/40 uppercase tracking-wide pb-3 pr-4">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {events.map(ev => {
                    const acting = eventActionLoading === ev.id
                    const statusStyle =
                      ev.status === 'active'
                        ? { bg: 'rgba(34,197,94,0.15)', color: '#22c55e' }
                        : ev.status === 'completed'
                        ? { bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }
                        : { bg: 'rgba(255,107,53,0.15)', color: '#ff6b35' }
                    return (
                      <tr key={ev.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td className="py-3 pr-4 text-white font-medium whitespace-nowrap">{ev.name}</td>
                        <td className="py-3 pr-4 text-white/70 whitespace-nowrap">
                          {ev.date}{ev.time ? ` · ${ev.time}` : ''}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap uppercase tracking-wider"
                            style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
                          >
                            {ev.status}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-white/70">{ev.max_players ?? '—'}</td>
                        <td className="py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingEvent({ ...ev })}
                              disabled={acting}
                              className="px-3 py-1 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                              style={{ backgroundColor: 'rgba(255,107,53,0.2)', border: '1px solid rgba(255,107,53,0.4)' }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteEvent(ev.id, ev.name)}
                              disabled={acting}
                              className="px-3 py-1 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                              style={{ backgroundColor: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }}
                            >
                              {acting ? '...' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── ALL USERS ── */}
        <section
          className="rounded-2xl p-6 mb-8"
          style={{ backgroundColor: '#0f2a1f', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <h2 className="text-lg font-bold text-white mb-4">
            All Users
            {!usersLoading && (
              <span className="ml-2 text-sm font-normal text-white/50">({users.length})</span>
            )}
          </h2>

          {usersLoading ? (
            <p className="text-sm text-white/50">Loading...</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-white/50">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {['Name', 'Email', 'Phone', 'Skill Score', 'Skill Level', 'Quiz', 'Events', ''].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-white/40 uppercase tracking-wide pb-3 pr-4">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => {
                    const level = u.quiz_completed_at && u.skill_score != null ? getLevel(u.skill_score) : null
                    const lc = level ? getLevelColor(level) : null
                    return (
                      <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td className="py-3 pr-4 text-white font-medium whitespace-nowrap">
                          {u.first_name || u.last_name ? `${u.first_name} ${u.last_name}`.trim() : '—'}
                        </td>
                        <td className="py-3 pr-4 text-white/70 whitespace-nowrap">{u.email || '—'}</td>
                        <td className="py-3 pr-4 text-white/70 whitespace-nowrap">{u.phone || '—'}</td>
                        <td className="py-3 pr-4 text-white/70">{u.skill_score != null ? u.skill_score : '—'}</td>
                        <td className="py-3 pr-4">
                          {lc && level ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap"
                              style={{ background: lc.bg, color: lc.text }}
                            >
                              {lc.icon && <span>{lc.icon}</span>}
                              {level}
                            </span>
                          ) : (
                            <span className="text-white/30">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-center">{u.quiz_completed_at ? '✅' : '❌'}</td>
                        <td className="py-3 pr-4 text-white/70 text-center">{u.event_count}</td>
                        <td className="py-3">
                          <button
                            onClick={() => setSelectedUser(u)}
                            className="px-3 py-1 rounded-lg text-xs font-semibold text-white"
                            style={{ backgroundColor: 'rgba(255,107,53,0.2)', border: '1px solid rgba(255,107,53,0.4)' }}
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── EVENT REGISTRATIONS ── */}
        <section
          className="rounded-2xl p-6"
          style={{ backgroundColor: '#0f2a1f', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-white">
              Event Registrations
              {!eventRegsLoading && (
                <span className="ml-2 text-sm font-normal text-white/50">({eventRegs.length})</span>
              )}
            </h2>
            {!eventRegsLoading && (
              <div className="flex gap-3 text-xs text-white/60">
                <span>
                  <span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1" />
                  {approved} approved
                </span>
                <span>
                  <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 mr-1" />
                  {pending} pending
                </span>
              </div>
            )}
          </div>

          {eventRegsLoading ? (
            <p className="text-sm text-white/50">Loading...</p>
          ) : eventRegs.length === 0 ? (
            <p className="text-sm text-white/50">No event registrations yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {['Name', 'Email', 'Phone', 'Event', 'Status', 'Skill', 'Actions'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-white/40 uppercase tracking-wide pb-3 pr-4">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {eventRegs.map(r => {
                    const name = [r.first_name, r.last_name].filter(Boolean).join(' ') || '—'
                    const isApproved = r.status === 'approved'
                    const isActing = actionLoading === r.id
                    const levelColor = r.skill_level ? getLevelColor(r.skill_level) : null
                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td className="py-3 pr-4 text-white font-medium whitespace-nowrap">{name}</td>
                        <td className="py-3 pr-4 text-white/70 whitespace-nowrap">{r.email || '—'}</td>
                        <td className="py-3 pr-4 text-white/70 whitespace-nowrap">{r.phone || '—'}</td>
                        <td className="py-3 pr-4 text-white/70">
                          <p className="whitespace-nowrap">{r.event_name || '—'}</p>
                          {r.event_date && (
                            <p className="text-white/40 text-xs">{r.event_date}{r.event_time ? ` · ${r.event_time}` : ''}</p>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap"
                            style={isApproved
                              ? { backgroundColor: 'rgba(34,197,94,0.15)', color: '#22c55e' }
                              : { backgroundColor: 'rgba(234,179,8,0.15)', color: '#eab308' }
                            }
                          >
                            {isApproved ? '✓ Approved' : '⏳ Pending'}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          {levelColor && r.skill_level ? (
                            <div>
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap"
                                style={{ background: levelColor.bg, color: levelColor.text }}
                              >
                                {levelColor.icon && <span>{levelColor.icon}</span>}
                                {r.skill_level}
                              </span>
                              {r.skill_score != null && (
                                <p className="text-[11px] text-white/40 mt-0.5">{r.skill_score} pts</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-white/30 text-xs">—</span>
                          )}
                        </td>
                        <td className="py-3">
                          <div className="flex gap-2">
                            {!isApproved && (
                              <button
                                onClick={() => handleApprove(r.id)}
                                disabled={isActing}
                                className="px-3 py-1 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                                style={{ backgroundColor: '#22c55e' }}
                              >
                                {isActing ? '...' : 'Approve'}
                              </button>
                            )}
                            <button
                              onClick={() => handleReject(r.id)}
                              disabled={isActing}
                              className="px-3 py-1 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                              style={{ backgroundColor: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }}
                            >
                              {isActing ? '...' : 'Reject'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── TEAM REGISTRATIONS ── */}
        <section
          className="rounded-2xl p-6 mt-6"
          style={{ backgroundColor: '#0f2a1f', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-white">
              Takım Kayıtları
              {!teamRegsLoading && (
                <span className="ml-2 text-sm font-normal text-white/50">({teamRegs.length})</span>
              )}
            </h2>
            {!teamRegsLoading && teamRegs.length > 0 && (
              <div className="flex gap-3 text-xs text-white/60">
                <span>
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-1" />
                  {teamRegs.filter(t => t.status === 'pending_approval').length} onay bekliyor
                </span>
              </div>
            )}
          </div>

          {teamRegsLoading ? (
            <p className="text-sm text-white/50">Yükleniyor...</p>
          ) : teamRegs.length === 0 ? (
            <p className="text-sm text-white/50">Henüz takım kaydı yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {['Takım', 'Kaptan', 'Partner', 'Etkinlik', 'Durum', 'İşlem'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-white/40 uppercase tracking-wide pb-3 pr-4">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teamRegs.map(t => {
                    const captainName = [t.captain?.first_name, t.captain?.last_name].filter(Boolean).join(' ') || '—'
                    const partnerName = [t.partner?.first_name, t.partner?.last_name].filter(Boolean).join(' ') || '—'
                    const isActing = teamActionLoading === t.id
                    const canAct = t.status === 'pending_approval'
                    return (
                      <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td className="py-3 pr-4 whitespace-nowrap">
                          <p className="font-bold" style={{ color: '#ff6b35' }}>{t.team_name}</p>
                        </td>
                        <td className="py-3 pr-4 text-white/80">
                          <p className="font-medium whitespace-nowrap">{captainName}</p>
                          {t.captain?.email && <p className="text-white/40 text-xs">{t.captain.email}</p>}
                        </td>
                        <td className="py-3 pr-4 text-white/80">
                          <p className="font-medium whitespace-nowrap">{partnerName}</p>
                          {t.partner?.email && <p className="text-white/40 text-xs">{t.partner.email}</p>}
                        </td>
                        <td className="py-3 pr-4 text-white/70 whitespace-nowrap">{t.event?.name ?? '—'}</td>
                        <td className="py-3 pr-4">{teamStatusBadge(t.status)}</td>
                        <td className="py-3">
                          {canAct ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleTeamApproval(t.id, 'approve')}
                                disabled={isActing}
                                className="px-3 py-1 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                                style={{ backgroundColor: '#22c55e' }}
                              >
                                {isActing ? '...' : '✅ Onayla'}
                              </button>
                              <button
                                onClick={() => handleTeamApproval(t.id, 'reject')}
                                disabled={isActing}
                                className="px-3 py-1 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                                style={{ backgroundColor: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }}
                              >
                                {isActing ? '...' : '❌ Reddet'}
                              </button>
                            </div>
                          ) : (
                            <span className="text-white/30 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Event Edit Modal */}
      {editingEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
          onClick={() => setEditingEvent(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: '#0f2a1f', border: '1px solid rgba(255,255,255,0.12)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white">Edit Tournament</h3>
              <button onClick={() => setEditingEvent(null)} className="text-white/50 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="block text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5">Name</span>
                <input
                  type="text"
                  value={editingEvent.name}
                  onChange={e => setEditingEvent({ ...editingEvent, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                  style={{ backgroundColor: '#1a3d2e', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5">Date</span>
                  <input
                    type="date"
                    value={editingEvent.date}
                    onChange={e => setEditingEvent({ ...editingEvent, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                    style={{ backgroundColor: '#1a3d2e', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </label>
                <label className="block">
                  <span className="block text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5">Time</span>
                  <input
                    type="time"
                    value={editingEvent.time ?? ''}
                    onChange={e => setEditingEvent({ ...editingEvent, time: e.target.value || null })}
                    className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                    style={{ backgroundColor: '#1a3d2e', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </label>
              </div>
              <label className="block">
                <span className="block text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5">Location</span>
                <input
                  type="text"
                  value={editingEvent.location ?? ''}
                  onChange={e => setEditingEvent({ ...editingEvent, location: e.target.value || null })}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                  style={{ backgroundColor: '#1a3d2e', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5">Max Players</span>
                  <input
                    type="number"
                    min={1}
                    value={editingEvent.max_players ?? 0}
                    onChange={e => setEditingEvent({ ...editingEvent, max_players: Number(e.target.value) || null })}
                    className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                    style={{ backgroundColor: '#1a3d2e', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </label>
                <label className="block">
                  <span className="block text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5">Entry Fee (€)</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={editingEvent.entry_fee ?? 0}
                    onChange={e => setEditingEvent({ ...editingEvent, entry_fee: Number(e.target.value) || null })}
                    className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                    style={{ backgroundColor: '#1a3d2e', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5">Format</span>
                  <select
                    value={editingEvent.format ?? 'Americano'}
                    onChange={e => setEditingEvent({ ...editingEvent, format: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                    style={{ backgroundColor: '#1a3d2e', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <option value="Americano">Americano</option>
                    <option value="Round Robin">Round Robin</option>
                    <option value="Elimination">Elimination</option>
                    <option value="Team">Team</option>
                  </select>
                </label>
                <label className="block">
                  <span className="block text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5">Status</span>
                  <select
                    value={editingEvent.status}
                    onChange={e => setEditingEvent({ ...editingEvent, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                    style={{ backgroundColor: '#1a3d2e', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="block text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5">Description</span>
                <textarea
                  value={editingEvent.description ?? ''}
                  onChange={e => setEditingEvent({ ...editingEvent, description: e.target.value || null })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none resize-y"
                  style={{ backgroundColor: '#1a3d2e', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setEditingEvent(null)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                  style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateEvent}
                  disabled={eventActionLoading === editingEvent.id}
                  className="px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50"
                  style={{ backgroundColor: '#ff6b35' }}
                >
                  {eventActionLoading === editingEvent.id ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Detail Modal */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: '#0f2a1f', border: '1px solid rgba(255,255,255,0.12)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white">User Details</h3>
              <button onClick={() => setSelectedUser(null)} className="text-white/50 hover:text-white text-xl leading-none">×</button>
            </div>
            <dl className="space-y-3">
              {[
                ['Name', `${selectedUser.first_name} ${selectedUser.last_name}`.trim() || '—'],
                ['Player Code', selectedUser.player_code ?? '—'],
                ['Email', selectedUser.email || '—'],
                ['Phone', selectedUser.phone || '—'],
                ['Skill Score', selectedUser.skill_score != null ? `${selectedUser.skill_score} pts` : '—'],
                ['Skill Level', selectedUser.quiz_completed_at && selectedUser.skill_score != null ? getLevel(selectedUser.skill_score) : '—'],
                ['Quiz Completed', selectedUser.quiz_completed_at ? new Date(selectedUser.quiz_completed_at).toLocaleDateString() : 'Not completed'],
                ['Registered Events', String(selectedUser.event_count)],
                ['Joined', new Date(selectedUser.created_at).toLocaleDateString()],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-xs font-semibold text-white/40 uppercase tracking-wide whitespace-nowrap">{label}</dt>
                  <dd className="text-sm text-white text-right">{value}</dd>
                </div>
              ))}
            </dl>

            {(pendingInvitesLoading || pendingInvites.length > 0) && (
              <div className="mt-6 pt-5" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <h4 className="text-sm font-bold text-white mb-3">Bekleyen Takım Davetleri</h4>
                {pendingInvitesLoading ? (
                  <p className="text-xs text-white/50">Yükleniyor...</p>
                ) : (
                  <div className="space-y-2">
                    {pendingInvites.map(inv => {
                      const badge = inv.status === 'pending_partner'
                        ? { text: 'Partner Bekleniyor', bg: 'rgba(234,179,8,0.15)', color: '#eab308' }
                        : { text: 'Admin Onayı Bekleniyor', bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' }
                      const isCanceling = cancelingInviteId === inv.id
                      return (
                        <div
                          key={inv.id}
                          className="rounded-lg p-3"
                          style={{ backgroundColor: '#1a3d2e', border: '1px solid rgba(255,255,255,0.08)' }}
                        >
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-white truncate" style={{ color: '#ff6b35' }}>{inv.team_name}</p>
                              <p className="text-xs text-white/60 truncate">{inv.event_name ?? '—'}</p>
                            </div>
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap"
                              style={{ backgroundColor: badge.bg, color: badge.color }}
                            >
                              {badge.text}
                            </span>
                          </div>
                          <button
                            onClick={() => handleCancelInvite(inv.id)}
                            disabled={isCanceling}
                            className="px-2.5 py-1 rounded-md text-[11px] font-semibold disabled:opacity-50"
                            style={{ backgroundColor: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }}
                          >
                            {isCanceling ? '...' : '🗑 İsteği Geri Çek'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
