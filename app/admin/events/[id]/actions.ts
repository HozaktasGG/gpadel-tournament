'use server'

import { revalidatePath } from 'next/cache'
import { Resend } from 'resend'
import { requireAdmin } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

type TeamStatus = 'pending_partner' | 'pending_approval' | 'approved' | 'rejected'
const TEAM_STATUSES: TeamStatus[] = ['pending_partner', 'pending_approval', 'approved', 'rejected']
const REG_STATUSES = ['approved', 'pending']
const EVENT_STATUSES = ['upcoming', 'active', 'completed']

class UserError extends Error {}

async function run<T>(eventId: string | null, fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    await requireAdmin()
    const data = await fn()
    if (eventId) {
      revalidatePath(`/admin/events/${eventId}`)
      revalidatePath(`/tournaments/${eventId}`)
    }
    return { ok: true, data }
  } catch (e) {
    console.error('[admin action]', e)
    return { ok: false, error: e instanceof Error ? e.message : 'Something went wrong.' }
  }
}

function fail(message: string): never {
  throw new UserError(message)
}

function dbFail(context: string, error: { message: string } | null): void {
  if (error) fail(`${context}: ${error.message}`)
}

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t === '' ? null : t
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

type ProfileLite = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  player_code: string | null
}

async function getProfiles(ids: string[]): Promise<Map<string, ProfileLite>> {
  if (ids.length === 0) return new Map()
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, email, player_code')
    .in('id', ids)
  dbFail('Failed to load profiles', error)
  return new Map(((data ?? []) as ProfileLite[]).map(p => [p.id, p]))
}

async function getEventLite(eventId: string) {
  const { data, error } = await supabaseAdmin
    .from('events')
    .select('id, name, date, time, location')
    .eq('id', eventId)
    .maybeSingle<{ id: string; name: string; date: string | null; time: string | null; location: string | null }>()
  dbFail('Failed to load event', error)
  if (!data) fail('Event not found.')
  return data
}

// Adds approved event_registrations rows for users that don't have one yet.
async function ensureRegistrations(eventId: string, userIds: string[]): Promise<string[]> {
  const unique = Array.from(new Set(userIds.filter(Boolean)))
  if (unique.length === 0) return []
  const { data: existing, error } = await supabaseAdmin
    .from('event_registrations')
    .select('user_id')
    .eq('event_id', eventId)
    .in('user_id', unique)
  dbFail('Failed to check registrations', error)
  const have = new Set((existing ?? []).map(r => r.user_id as string))
  const missing = unique.filter(id => !have.has(id))
  if (missing.length > 0) {
    const { error: insErr } = await supabaseAdmin
      .from('event_registrations')
      .insert(missing.map(user_id => ({ event_id: eventId, user_id, status: 'approved' })))
    dbFail('Failed to add registrations', insErr)
  }
  return missing
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

async function sendConfirmationEmails(
  event: { id: string; name: string; date: string | null; time: string | null; location: string | null },
  recipients: ProfileLite[],
  teamName?: string
): Promise<number> {
  const resend = new Resend(process.env.RESEND_API_KEY)
  let sent = 0
  for (const p of recipients) {
    if (!p.email) continue
    const firstName = escapeHtml(p.first_name || 'there')
    const eventName = escapeHtml(event.name)
    const teamLine = teamName ? `<p style="margin:0 0 10px;font-size:14px;color:#333;">👥 Team: <strong>${escapeHtml(teamName)}</strong></p>` : ''
    const { error } = await resend.emails.send({
      from: 'info@smashtorino.com',
      to: p.email,
      subject: `SmashTorino - You're registered for ${event.name} ✅`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#ffffff;">
          <p style="font-size:18px;font-weight:bold;color:#111;margin:0 0 8px;">Hi ${firstName},</p>
          <p style="font-size:15px;color:#333;margin:0 0 24px;">You've been registered for <strong>${eventName}</strong>.</p>
          <div style="background:#f9f9f9;border-radius:8px;padding:20px 24px;margin-bottom:28px;">
            ${teamLine}
            ${event.date ? `<p style="margin:0 0 10px;font-size:14px;color:#333;">📅 <strong>${escapeHtml(event.date)}</strong></p>` : ''}
            ${event.time ? `<p style="margin:0 0 10px;font-size:14px;color:#333;">🕐 <strong>${escapeHtml(event.time)}</strong></p>` : ''}
            ${event.location ? `<p style="margin:0;font-size:14px;color:#333;">📍 <strong>${escapeHtml(event.location)}</strong></p>` : ''}
          </div>
          <a href="https://smashtorino.com/tournaments/${event.id}"
             style="display:inline-block;background:#ff6b35;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 24px;border-radius:6px;">
            View Tournament
          </a>
          <p style="font-size:13px;color:#888;margin-top:32px;">See you on the court!<br/><strong style="color:#333;">SmashTorino Padel Community</strong></p>
        </div>
      `,
    })
    if (error) console.error('[admin email]', p.email, error)
    else sent++
  }
  return sent
}

// ───────────────────────── Event ─────────────────────────

export type EventUpdateInput = {
  name: string
  date: string
  time: string | null
  location: string | null
  max_players: number | null
  entry_fee: number | null
  description: string | null
  format: string | null
  status: string
  image_url: string | null
  pdf_url: string | null
  featured?: boolean | null
  subtitle?: string | null
}

export async function updateEvent(eventId: string, input: EventUpdateInput) {
  return run(eventId, async () => {
    const name = str(input.name)
    const date = str(input.date)
    if (!name) fail('Name is required.')
    if (!date) fail('Date is required.')
    if (!EVENT_STATUSES.includes(input.status)) fail('Invalid status.')
    const maxPlayers = num(input.max_players)
    if (maxPlayers !== null && (maxPlayers < 0 || !Number.isInteger(maxPlayers))) fail('Max players must be a whole number.')
    const entryFee = num(input.entry_fee)
    if (entryFee !== null && entryFee < 0) fail('Entry fee cannot be negative.')

    const { error } = await supabaseAdmin
      .from('events')
      .update({
        name,
        date,
        time: str(input.time),
        location: str(input.location),
        max_players: maxPlayers,
        entry_fee: entryFee,
        description: str(input.description),
        format: str(input.format),
        status: input.status,
        image_url: str(input.image_url),
        pdf_url: str(input.pdf_url),
        // Only touched when the editor sends them (events.featured / events.subtitle).
        ...(input.featured !== undefined ? { featured: !!input.featured } : {}),
        ...(input.subtitle !== undefined ? { subtitle: str(input.subtitle) } : {}),
      })
      .eq('id', eventId)
    dbFail('Failed to update event', error)
    revalidatePath('/tournaments')
    return undefined
  })
}

export async function setRegistrationOpen(eventId: string, open: boolean) {
  return run(eventId, async () => {
    const { error } = await supabaseAdmin.from('events').update({ registration_open: !!open }).eq('id', eventId)
    dbFail('Failed to update registration', error)
    revalidatePath('/tournaments')
    return undefined
  })
}

// ───────────────────── Individual registrations ─────────────────────

export async function addRegistrations(eventId: string, userIds: string[], sendEmail: boolean) {
  return run(eventId, async () => {
    if (!Array.isArray(userIds) || userIds.length === 0) fail('Select at least one player.')
    const event = await getEventLite(eventId)
    const added = await ensureRegistrations(eventId, userIds)
    let emailed = 0
    if (sendEmail && added.length > 0) {
      const profiles = await getProfiles(added)
      emailed = await sendConfirmationEmails(event, Array.from(profiles.values()))
    }
    return { added: added.length, emailed }
  })
}

export async function removeRegistration(eventId: string, registrationId: string) {
  return run(eventId, async () => {
    const { data: reg, error: regErr } = await supabaseAdmin
      .from('event_registrations')
      .select('user_id')
      .eq('id', registrationId)
      .eq('event_id', eventId)
      .maybeSingle<{ user_id: string }>()
    dbFail('Failed to load registration', regErr)
    if (!reg) fail('Registration not found.')

    const { data: teams, error: teamErr } = await supabaseAdmin
      .from('team_registrations')
      .select('team_name')
      .eq('event_id', eventId)
      .or(`captain_id.eq.${reg.user_id},partner_id.eq.${reg.user_id}`)
    dbFail('Failed to check teams', teamErr)
    if (teams && teams.length > 0) {
      fail(`This player is in team "${teams[0].team_name}". Remove or edit the team first.`)
    }

    const { error } = await supabaseAdmin.from('event_registrations').delete().eq('id', registrationId)
    dbFail('Failed to remove player', error)
    return undefined
  })
}

export async function setRegistrationStatus(eventId: string, registrationId: string, status: string) {
  return run(eventId, async () => {
    if (!REG_STATUSES.includes(status)) fail('Invalid status.')
    const { error } = await supabaseAdmin
      .from('event_registrations')
      .update({ status })
      .eq('id', registrationId)
      .eq('event_id', eventId)
    dbFail('Failed to update status', error)
    return undefined
  })
}

// ───────────────────────── Profiles ─────────────────────────

export async function updateProfile(
  eventId: string | null,
  profileId: string,
  input: { first_name: string; last_name: string; player_code: string }
) {
  return run(eventId, async () => {
    const firstName = str(input.first_name)
    if (!firstName) fail('First name is required.')
    const playerCode = str(input.player_code)?.toUpperCase() ?? null

    if (playerCode) {
      const { data: clash, error: clashErr } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, player_code')
        .eq('player_code', playerCode)
        .neq('id', profileId)
        .limit(1)
      dbFail('Failed to check player code', clashErr)
      if (clash && clash.length > 0) {
        const other = [clash[0].first_name, clash[0].last_name].filter(Boolean).join(' ')
        fail(`Player code ${playerCode} is already used by ${other || 'another player'}.`)
      }
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ first_name: firstName, last_name: str(input.last_name) ?? '', player_code: playerCode })
      .eq('id', profileId)
    dbFail('Failed to update profile', error)

    // Keep partner_code on teams in sync with the partner's code.
    if (playerCode) {
      await supabaseAdmin.from('team_registrations').update({ partner_code: playerCode }).eq('partner_id', profileId)
    }
    revalidatePath('/admin')
    return undefined
  })
}

// ───────────────────────── Teams ─────────────────────────

type TeamRow = {
  id: string
  event_id: string
  team_name: string
  captain_id: string
  partner_id: string | null
  status: TeamStatus
}

async function getTeam(eventId: string, teamId: string): Promise<TeamRow> {
  const { data, error } = await supabaseAdmin
    .from('team_registrations')
    .select('id, event_id, team_name, captain_id, partner_id, status')
    .eq('id', teamId)
    .eq('event_id', eventId)
    .maybeSingle<TeamRow>()
  dbFail('Failed to load team', error)
  if (!data) fail('Team not found.')
  return data
}

function personName(p: ProfileLite | undefined) {
  if (!p) return 'This player'
  return [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || 'This player'
}

// Throws if any of the players is already in another team of the event.
async function assertNotInOtherTeam(eventId: string, playerIds: string[], excludeTeamIds: string[]) {
  const { data, error } = await supabaseAdmin
    .from('team_registrations')
    .select('id, team_name, captain_id, partner_id')
    .eq('event_id', eventId)
  dbFail('Failed to check teams', error)
  const profiles = await getProfiles(playerIds)
  for (const t of (data ?? []) as TeamRow[]) {
    if (excludeTeamIds.includes(t.id)) continue
    for (const pid of playerIds) {
      if (t.captain_id === pid || t.partner_id === pid) {
        fail(`${personName(profiles.get(pid))} is already in team "${t.team_name}".`)
      }
    }
  }
}

export async function createTeam(
  eventId: string,
  input: { captain_id: string; partner_id: string; team_name: string; sendEmail: boolean }
) {
  return run(eventId, async () => {
    const { captain_id, partner_id } = input
    if (!captain_id || !partner_id) fail('Pick both a captain and a partner.')
    if (captain_id === partner_id) fail('Captain and partner must be different players.')
    const teamName = str(input.team_name)
    if (!teamName) fail('Team name is required.')

    const event = await getEventLite(eventId)
    await assertNotInOtherTeam(eventId, [captain_id, partner_id], [])
    const profiles = await getProfiles([captain_id, partner_id])
    if (!profiles.get(captain_id) || !profiles.get(partner_id)) fail('Player not found.')

    const { error } = await supabaseAdmin.from('team_registrations').insert({
      event_id: eventId,
      captain_id,
      partner_id,
      partner_code: profiles.get(partner_id)?.player_code ?? '',
      team_name: teamName,
      status: 'approved',
      captain_confirmed: true,
      partner_confirmed: true,
    })
    dbFail('Failed to create team', error)

    await ensureRegistrations(eventId, [captain_id, partner_id])
    let emailed = 0
    if (input.sendEmail) {
      emailed = await sendConfirmationEmails(event, Array.from(profiles.values()), teamName)
    }
    return { emailed }
  })
}

export async function updateTeam(
  eventId: string,
  teamId: string,
  input: { team_name: string; captain_id: string; partner_id: string | null; status: TeamStatus }
) {
  return run(eventId, async () => {
    const team = await getTeam(eventId, teamId)
    const teamName = str(input.team_name)
    if (!teamName) fail('Team name is required.')
    if (!TEAM_STATUSES.includes(input.status)) fail('Invalid status.')
    if (!input.captain_id) fail('A team needs a captain.')
    if (input.partner_id && input.captain_id === input.partner_id) fail('Captain and partner must be different players.')

    const players = [input.captain_id, input.partner_id].filter((p): p is string => !!p)
    await assertNotInOtherTeam(eventId, players, [teamId])

    const update: Record<string, unknown> = {
      team_name: teamName,
      status: input.status,
      captain_id: input.captain_id,
      partner_id: input.partner_id,
      updated_at: new Date().toISOString(),
    }
    if (input.partner_id !== team.partner_id) {
      const profiles = await getProfiles(input.partner_id ? [input.partner_id] : [])
      update.partner_code = input.partner_id ? profiles.get(input.partner_id)?.player_code ?? '' : ''
      if (input.partner_id) update.partner_confirmed = true
    }
    if (input.captain_id !== team.captain_id) update.captain_confirmed = true

    const { error } = await supabaseAdmin.from('team_registrations').update(update).eq('id', teamId)
    dbFail('Failed to update team', error)

    await ensureRegistrations(eventId, players)
    return undefined
  })
}

export type TeamSlot = 'captain' | 'partner'

export async function swapPlayers(
  eventId: string,
  a: { teamId: string; slot: TeamSlot },
  b: { teamId: string; slot: TeamSlot }
) {
  return run(eventId, async () => {
    if (a.teamId === b.teamId) fail('Pick players from two different teams.')
    const [teamA, teamB] = await Promise.all([getTeam(eventId, a.teamId), getTeam(eventId, b.teamId)])
    const col = (s: TeamSlot): 'captain_id' | 'partner_id' => (s === 'captain' ? 'captain_id' : 'partner_id')
    const playerA = teamA[col(a.slot)]
    const playerB = teamB[col(b.slot)]
    if (!playerA || !playerB) fail('Both slots must have a player to swap.')

    const profiles = await getProfiles([playerA, playerB])
    const now = new Date().toISOString()
    const patch = (slot: TeamSlot, playerId: string) => ({
      [col(slot)]: playerId,
      ...(slot === 'partner'
        ? { partner_code: profiles.get(playerId)?.player_code ?? '', partner_confirmed: true }
        : { captain_confirmed: true }),
      updated_at: now,
    })

    const { error: e1 } = await supabaseAdmin.from('team_registrations').update(patch(a.slot, playerB)).eq('id', teamA.id)
    dbFail('Swap failed', e1)
    const { error: e2 } = await supabaseAdmin.from('team_registrations').update(patch(b.slot, playerA)).eq('id', teamB.id)
    if (e2) {
      // Roll back the first update so nobody ends up in two teams.
      await supabaseAdmin.from('team_registrations').update(patch(a.slot, playerA)).eq('id', teamA.id)
      fail(`Swap failed: ${e2.message}`)
    }
    return undefined
  })
}

export async function deleteTeam(eventId: string, teamId: string, alsoRemoveRegistrations: boolean) {
  return run(eventId, async () => {
    const team = await getTeam(eventId, teamId)

    const [groups, matches] = await Promise.all([
      supabaseAdmin.from('team_tournament_groups').select('id', { count: 'exact', head: true }).eq('team_registration_id', teamId),
      supabaseAdmin
        .from('team_tournament_matches')
        .select('id', { count: 'exact', head: true })
        .or(`team1_id.eq.${teamId},team2_id.eq.${teamId},winner_id.eq.${teamId}`),
    ])
    dbFail('Failed to check fixtures', groups.error)
    dbFail('Failed to check fixtures', matches.error)
    if ((groups.count ?? 0) > 0 || (matches.count ?? 0) > 0) {
      fail(`"${team.team_name}" is already part of the generated fixtures, so it can't be deleted. Replace or swap its players instead.`)
    }

    const { error } = await supabaseAdmin.from('team_registrations').delete().eq('id', teamId)
    dbFail('Failed to delete team', error)

    if (alsoRemoveRegistrations) {
      const players = [team.captain_id, team.partner_id].filter((p): p is string => !!p)
      if (players.length > 0) {
        const { error: regErr } = await supabaseAdmin
          .from('event_registrations')
          .delete()
          .eq('event_id', eventId)
          .in('user_id', players)
        dbFail('Team deleted, but removing registrations failed', regErr)
      }
    }
    return undefined
  })
}
