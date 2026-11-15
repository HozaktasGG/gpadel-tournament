import 'server-only'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getLevel } from '@/lib/quiz-questions'
import {
  type CourtPoints,
  type LightsOutFormat,
  type LOMatch,
  type LOPublicState,
  type LOStanding,
  type LOTournament,
  LO_MATCH_COLUMNS,
  LO_TOURNAMENT_COLUMNS,
  drawMatchesOf,
  isLightsOut,
  lightsOutFormat,
} from '@/lib/lights-out'

export type LOTeamRow = { id: string; team_name: string; captain_id: string | null; partner_id: string | null }

export type LOEventState = {
  eventId: string
  eventName: string
  format: LightsOutFormat
  teams: LOTeamRow[]
  teamIds: string[]
  matches: LOMatch[]
  tournament: LOTournament | null
}

const json = (error: string, status: number) => NextResponse.json({ error }, { status })

// Admins, or a manager assigned to this event (event_managers), may run Lights Out actions.
async function lightsOutGuard(eventId: string): Promise<NextResponse | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return json('Unauthorized', 401)

  const [profileRes, managerRes] = await Promise.all([
    supabaseAdmin.from('profiles').select('is_admin, player_code').eq('id', user.id).maybeSingle<{ is_admin: boolean | null }>(),
    supabaseAdmin.from('event_managers').select('id').eq('user_id', user.id).eq('event_id', eventId).maybeSingle(),
  ])
  if (profileRes.data?.is_admin || managerRes.data) return null
  return json('Forbidden', 403)
}

async function loadLOEvent(eventId: string): Promise<LOEventState | NextResponse> {
  const { data: event } = await supabaseAdmin
    .from('events')
    .select('id, name, format')
    .eq('id', eventId)
    .maybeSingle<{ id: string; name: string; format: string | null }>()
  if (!event) return json('Event not found.', 404)
  if (!isLightsOut(event.format)) return json('This event is not a Lights Out event.', 400)

  const [teamsRes, matchesRes, tournamentRes] = await Promise.all([
    supabaseAdmin
      .from('team_registrations')
      .select('id, team_name, captain_id, partner_id')
      .eq('event_id', eventId)
      .eq('status', 'approved')
      .order('created_at', { ascending: true }),
    supabaseAdmin.from('team_tournament_matches').select(LO_MATCH_COLUMNS).eq('event_id', eventId),
    supabaseAdmin.from('lights_out_tournaments').select(LO_TOURNAMENT_COLUMNS).eq('event_id', eventId).maybeSingle<LOTournament>(),
  ])
  const failed = teamsRes.error ?? matchesRes.error ?? tournamentRes.error
  if (failed) return json('Failed to load the event: ' + failed.message, 500)

  const teams = (teamsRes.data ?? []) as LOTeamRow[]
  return {
    eventId,
    eventName: event.name,
    format: lightsOutFormat(event.format),
    teams,
    teamIds: teams.map(t => t.id),
    matches: (matchesRes.data ?? []) as LOMatch[],
    tournament: tournamentRes.data ?? null,
  }
}

// Shared wrapper for the Lights Out POST routes: parse body → auth → load state → handler.
export async function lightsOutRoute<B extends { eventId?: unknown }>(
  req: Request,
  handler: (body: B, state: LOEventState) => Promise<NextResponse>
): Promise<NextResponse> {
  let body: B
  try {
    body = (await req.json()) as B
  } catch {
    return json('Invalid request.', 400)
  }
  const eventId = typeof body?.eventId === 'string' ? body.eventId.trim() : ''
  if (!eventId) return json('Missing eventId.', 400)

  const denied = await lightsOutGuard(eventId)
  if (denied) return denied

  const state = await loadLOEvent(eventId)
  if (state instanceof NextResponse) return state
  try {
    return await handler(body, state)
  } catch (e) {
    console.error('LIGHTS-OUT ERROR:', e)
    return json(e instanceof Error ? e.message : 'Unknown error', 500)
  }
}

export const loError = json

// Applies the leaderboard points for these standings (both players of a team get the
// team's points). All of it happens in one database transaction, as a diff against what
// was applied before, so repeating it or re-applying after an edit never double-counts.
// An empty standings list rolls every point of this event back.
export async function applyLightsOutPoints(
  state: LOEventState,
  standings: LOStanding[],
  pointsTable: CourtPoints[]
): Promise<{ players: number } | { error: string }> {
  const teamById = new Map(state.teams.map(t => [t.id, t]))
  const entries: { user_id: string; change: number }[] = []
  const seen = new Set<string>()
  for (const s of standings) {
    const team = teamById.get(s.team_id)
    if (!team) return { error: 'A team in the final is no longer an approved team of this event.' }
    for (const userId of [team.captain_id, team.partner_id]) {
      if (!userId) continue
      if (seen.has(userId)) return { error: `A player is in two teams (${team.team_name}). Fix the teams first.` }
      seen.add(userId)
      entries.push({ user_id: userId, change: s.points })
    }
  }

  const { data, error } = await supabaseAdmin.rpc('lights_out_apply_points', {
    p_event_id: state.eventId,
    p_reason: state.eventName,
    p_entries: entries,
    p_points_table: pointsTable,
    p_standings: standings,
  })
  if (error) return { error: 'Applying points failed: ' + error.message }

  // skill_level is derived from the score, so refreshing it is safe to repeat.
  const rows = (data ?? []) as { profile_id: string; new_score: number }[]
  const results = await Promise.all(
    rows.map(r => supabaseAdmin.from('profiles').update({ skill_level: getLevel(r.new_score) }).eq('id', r.profile_id))
  )
  const levelError = results.find(r => r.error)?.error
  if (levelError) return { error: 'Points were applied, but updating skill levels failed: ' + levelError.message }
  return { players: entries.length }
}

// Read-only data for the public event page: team and player names only.
export async function loadLightsOutPublic(eventId: string): Promise<LOPublicState | null> {
  const [tournamentRes, matchesRes, teamsRes] = await Promise.all([
    supabaseAdmin.from('lights_out_tournaments').select(LO_TOURNAMENT_COLUMNS).eq('event_id', eventId).maybeSingle<LOTournament>(),
    supabaseAdmin.from('team_tournament_matches').select(LO_MATCH_COLUMNS).eq('event_id', eventId).eq('phase', 'draw'),
    supabaseAdmin
      .from('team_registrations')
      .select('id, team_name, captain_id, partner_id')
      .eq('event_id', eventId)
      .eq('status', 'approved'),
  ])
  const tournament = tournamentRes.data
  if (!tournament) return null

  const teamRows = (teamsRes.data ?? []) as LOTeamRow[]
  const playerIds = teamRows.flatMap(t => [t.captain_id, t.partner_id]).filter((id): id is string => !!id)
  const names = new Map<string, string>()
  if (playerIds.length > 0) {
    const { data } = await supabaseAdmin.from('profiles').select('id, first_name, last_name, player_code').in('id', playerIds)
    for (const p of (data ?? []) as { id: string; first_name: string | null; last_name: string | null }[]) {
      names.set(p.id, [p.first_name, p.last_name].filter(Boolean).join(' ').trim())
    }
  }

  return {
    courts: tournament.courts,
    started: !!tournament.started_at,
    teams: teamRows.map(t => ({
      id: t.id,
      team_name: t.team_name,
      players: [t.captain_id, t.partner_id].map(id => (id ? names.get(id) ?? '' : '')).filter(Boolean),
    })),
    draw: drawMatchesOf((matchesRes.data ?? []) as LOMatch[])
      .filter(m => m.team1_id && m.team2_id)
      .map(m => ({ court: m.match_order ?? 0, team1_id: m.team1_id as string, team2_id: m.team2_id as string })),
    standings: tournament.points_applied_at ? tournament.applied_standings : null,
  }
}
