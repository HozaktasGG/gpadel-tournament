import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const GROUPS = ['A', 'B', 'C', 'D'] as const

type GroupRow = {
  team_registration_id: string
  group_name: string
}
type GroupMatch = {
  group_name: string | null
  team1_id: string | null
  team2_id: string | null
  team1_score: number | null
  team2_score: number | null
}

type Standing = {
  team_id: string
  wins: number
  setsDiff: number
}

function rankGroup(groupName: string, groupRows: GroupRow[], matches: GroupMatch[]): Standing[] {
  const teamIds = groupRows
    .filter(g => g.group_name === groupName)
    .map(g => g.team_registration_id)
  const standings: Standing[] = teamIds.map(team_id => ({ team_id, wins: 0, setsDiff: 0 }))
  for (const m of matches) {
    if (m.group_name !== groupName) continue
    if (m.team1_score == null || m.team2_score == null) continue
    const a = standings.find(s => s.team_id === m.team1_id)
    const b = standings.find(s => s.team_id === m.team2_id)
    if (!a || !b) continue
    a.setsDiff += m.team1_score - m.team2_score
    b.setsDiff += m.team2_score - m.team1_score
    if (m.team1_score > m.team2_score) a.wins++
    else if (m.team2_score > m.team1_score) b.wins++
  }
  return standings.sort((x, y) => {
    if (y.wins !== x.wins) return y.wins - x.wins
    return y.setsDiff - x.setsDiff
  })
}

export async function POST(req: NextRequest) {
  let body: { password?: string; eventId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (body.password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  const eventId = body.eventId?.trim()
  if (!eventId) {
    return NextResponse.json({ error: 'Missing eventId.' }, { status: 400 })
  }

  const { data: existingKnockout } = await supabaseAdmin
    .from('team_tournament_matches')
    .select('id')
    .eq('event_id', eventId)
    .neq('phase', 'group')
    .limit(1)

  if (existingKnockout && existingKnockout.length > 0) {
    return NextResponse.json({ error: 'Knockout already generated.' }, { status: 409 })
  }

  const [groupsRes, matchesRes] = await Promise.all([
    supabaseAdmin
      .from('team_tournament_groups')
      .select('team_registration_id, group_name')
      .eq('event_id', eventId),
    supabaseAdmin
      .from('team_tournament_matches')
      .select('group_name, team1_id, team2_id, team1_score, team2_score')
      .eq('event_id', eventId)
      .eq('phase', 'group'),
  ])

  const groupRows = (groupsRes.data ?? []) as GroupRow[]
  const groupMatches = (matchesRes.data ?? []) as GroupMatch[]

  if (groupRows.length === 0) {
    return NextResponse.json({ error: 'No groups found. Draw groups first.' }, { status: 400 })
  }
  if (groupMatches.length === 0 || groupMatches.some(m => m.team1_score == null || m.team2_score == null)) {
    return NextResponse.json({ error: 'All group stage matches must be completed.' }, { status: 400 })
  }

  const standingsByGroup: Record<string, Standing[]> = {}
  for (const g of GROUPS) {
    standingsByGroup[g] = rankGroup(g, groupRows, groupMatches)
  }

  const top = (g: string, pos: 1 | 2) => standingsByGroup[g][pos - 1]?.team_id ?? null

  type MatchInsert = {
    event_id: string
    phase: 'quarter' | 'semi' | 'final'
    match_order: number
    team1_id: string | null
    team2_id: string | null
  }

  const inserts: MatchInsert[] = [
    { event_id: eventId, phase: 'quarter', match_order: 1, team1_id: top('A', 1), team2_id: top('B', 2) },
    { event_id: eventId, phase: 'quarter', match_order: 2, team1_id: top('B', 1), team2_id: top('A', 2) },
    { event_id: eventId, phase: 'quarter', match_order: 3, team1_id: top('C', 1), team2_id: top('D', 2) },
    { event_id: eventId, phase: 'quarter', match_order: 4, team1_id: top('D', 1), team2_id: top('C', 2) },
    { event_id: eventId, phase: 'semi', match_order: 1, team1_id: null, team2_id: null },
    { event_id: eventId, phase: 'semi', match_order: 2, team1_id: null, team2_id: null },
    { event_id: eventId, phase: 'final', match_order: 1, team1_id: null, team2_id: null },
  ]

  const { error: insertErr } = await supabaseAdmin
    .from('team_tournament_matches')
    .insert(inserts)
  if (insertErr) {
    return NextResponse.json({ error: 'Failed to insert: ' + insertErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
