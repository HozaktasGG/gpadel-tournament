import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { LiveState, TAMatch } from '@/lib/team-americano'
import { MATCH_COLUMNS, TA_FORMAT } from '@/lib/team-americano-server'

export const dynamic = 'force-dynamic'

type EventRow = NonNullable<LiveState['event']>
type TeamRow = { id: string; team_name: string; captain_id: string | null; partner_id: string | null }
type ProfileRow = { id: string; first_name: string | null; last_name: string | null }

const EMPTY: LiveState = { event: null, teams: [], matches: [] }

// Public, read-only state for the live Team Americano view. Exposes team names,
// player names and scores only. ?event=<id> picks an event explicitly; otherwise
// the most recent upcoming/active Team Americano event that has started.
export async function GET(req: NextRequest) {
  const requested = req.nextUrl.searchParams.get('event')?.trim()

  let event: EventRow | null = null
  if (requested) {
    const { data } = await supabaseAdmin
      .from('events')
      .select('id, name, date')
      .eq('id', requested)
      .eq('format', TA_FORMAT)
      .maybeSingle<EventRow>()
    event = data
  } else {
    const { data: candidates } = await supabaseAdmin
      .from('events')
      .select('id, name, date')
      .eq('format', TA_FORMAT)
      .in('status', ['upcoming', 'active'])
      .order('date', { ascending: false })
    for (const ev of (candidates ?? []) as EventRow[]) {
      const { count } = await supabaseAdmin
        .from('team_tournament_matches')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', ev.id)
      if ((count ?? 0) > 0) {
        event = ev
        break
      }
    }
  }
  if (!event) return NextResponse.json(EMPTY)

  const [teamsRes, matchesRes] = await Promise.all([
    supabaseAdmin
      .from('team_registrations')
      .select('id, team_name, captain_id, partner_id')
      .eq('event_id', event.id)
      .eq('status', 'approved')
      .order('created_at', { ascending: true }),
    supabaseAdmin.from('team_tournament_matches').select(MATCH_COLUMNS).eq('event_id', event.id),
  ])
  const teamRows = (teamsRes.data ?? []) as TeamRow[]
  const playerIds = teamRows.flatMap(t => [t.captain_id, t.partner_id]).filter((id): id is string => !!id)

  const names = new Map<string, string>()
  if (playerIds.length > 0) {
    const { data } = await supabaseAdmin.from('profiles').select('id, first_name, last_name').in('id', playerIds)
    for (const p of (data ?? []) as ProfileRow[]) {
      names.set(p.id, [p.first_name, p.last_name].filter(Boolean).join(' ').trim())
    }
  }

  const state: LiveState = {
    event,
    teams: teamRows.map(t => ({
      id: t.id,
      team_name: t.team_name,
      players: [t.captain_id, t.partner_id]
        .map(id => (id ? names.get(id) ?? '' : ''))
        .filter(Boolean),
    })),
    matches: (matchesRes.data ?? []) as TAMatch[],
  }
  return NextResponse.json(state)
}
