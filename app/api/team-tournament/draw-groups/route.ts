import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const GROUPS = ['A', 'B', 'C', 'D'] as const

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
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

  const { data: existingGroups } = await supabaseAdmin
    .from('team_tournament_groups')
    .select('id')
    .eq('event_id', eventId)
    .limit(1)

  if (existingGroups && existingGroups.length > 0) {
    return NextResponse.json({ error: 'Groups already drawn.' }, { status: 409 })
  }

  const { data: teams } = await supabaseAdmin
    .from('team_registrations')
    .select('id')
    .eq('event_id', eventId)
    .eq('status', 'approved')

  const teamIds = (teams ?? []).map(t => t.id as string)
  if (teamIds.length !== 16) {
    return NextResponse.json(
      { error: `Need exactly 16 approved teams (found ${teamIds.length}).` },
      { status: 400 }
    )
  }

  const shuffled = shuffle(teamIds)
  const groupRows = shuffled.map((tid, i) => ({
    event_id: eventId,
    team_registration_id: tid,
    group_name: GROUPS[Math.floor(i / 4)],
    position: (i % 4) + 1,
  }))

  const { error: groupsErr } = await supabaseAdmin
    .from('team_tournament_groups')
    .insert(groupRows)
  if (groupsErr) {
    return NextResponse.json({ error: 'Failed to create groups: ' + groupsErr.message }, { status: 500 })
  }

  // Generate group matches: round-robin for 4 teams = 6 matches per group
  type MatchInsert = {
    event_id: string
    phase: 'group'
    group_name: string
    round_number: number
    team1_id: string
    team2_id: string
    match_order: number
  }
  const matchRows: MatchInsert[] = []
  let matchOrder = 1
  for (const groupName of GROUPS) {
    const groupTeams = groupRows
      .filter(r => r.group_name === groupName)
      .sort((a, b) => a.position - b.position)
    const t = groupTeams.map(g => g.team_registration_id)
    const pairings: Array<[number, number, number]> = [
      [1, 0, 1], [1, 2, 3],
      [2, 0, 2], [2, 1, 3],
      [3, 0, 3], [3, 1, 2],
    ]
    for (const [round, i, j] of pairings) {
      matchRows.push({
        event_id: eventId,
        phase: 'group',
        group_name: groupName,
        round_number: round,
        team1_id: t[i],
        team2_id: t[j],
        match_order: matchOrder++,
      })
    }
  }

  const { error: matchesErr } = await supabaseAdmin
    .from('team_tournament_matches')
    .insert(matchRows)
  if (matchesErr) {
    return NextResponse.json({ error: 'Failed to create matches: ' + matchesErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
