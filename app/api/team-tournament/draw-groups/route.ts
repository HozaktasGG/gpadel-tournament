import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const GROUPS = ['A', 'B', 'C', 'D'] as const

// Court schedule from the official PDF.
// Each row: [slot 1-8, court 1-3, group A-D, team position 1-4, team position 1-4]
// Slots 1-4 host Groups A & B; slots 5-8 host Groups C & D.
const SCHEDULE: Array<[number, number, 'A' | 'B' | 'C' | 'D', number, number]> = [
  [1, 1, 'A', 1, 2],
  [1, 2, 'A', 3, 4],
  [1, 3, 'B', 1, 2],
  [2, 1, 'B', 3, 4],
  [2, 2, 'A', 1, 3],
  [2, 3, 'A', 2, 4],
  [3, 1, 'B', 1, 3],
  [3, 2, 'B', 2, 4],
  [3, 3, 'A', 1, 4],
  [4, 1, 'A', 2, 3],
  [4, 2, 'B', 1, 4],
  [4, 3, 'B', 2, 3],
  [5, 1, 'C', 1, 2],
  [5, 2, 'C', 3, 4],
  [5, 3, 'D', 1, 2],
  [6, 1, 'D', 3, 4],
  [6, 2, 'C', 1, 3],
  [6, 3, 'C', 2, 4],
  [7, 1, 'D', 1, 3],
  [7, 2, 'D', 2, 4],
  [7, 3, 'C', 1, 4],
  [8, 1, 'C', 2, 3],
  [8, 2, 'D', 1, 4],
  [8, 3, 'D', 2, 3],
]

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

  const teamFor = (group: string, pos: number): string => {
    const row = groupRows.find(r => r.group_name === group && r.position === pos)
    if (!row) throw new Error(`Missing team ${group}${pos}`)
    return row.team_registration_id
  }

  type MatchInsert = {
    event_id: string
    phase: 'group'
    group_name: string
    round_number: number
    team1_id: string
    team2_id: string
    match_order: number
  }
  const matchRows: MatchInsert[] = SCHEDULE.map(([slot, court, group, pos1, pos2]) => ({
    event_id: eventId,
    phase: 'group',
    group_name: group,
    round_number: slot,
    team1_id: teamFor(group, pos1),
    team2_id: teamFor(group, pos2),
    match_order: court,
  }))

  const { error: matchesErr } = await supabaseAdmin
    .from('team_tournament_matches')
    .insert(matchRows)
  if (matchesErr) {
    return NextResponse.json({ error: 'Failed to create matches: ' + matchesErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
