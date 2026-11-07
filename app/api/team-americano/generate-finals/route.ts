import { NextRequest, NextResponse } from 'next/server'
import { adminGuard } from '@/lib/admin-auth'
import { finalsDecision } from '@/lib/team-americano'
import { insertFinals, loadTAEvent, parseCourts, readJson } from '@/lib/team-americano-server'

// Finals: #1v#2 (court 1), #3v#4 (court 2), ... from the group standings.
// `order` (optional) is the admin-confirmed seeding when a tie was decided by the random draw;
// without it, a tie that changes the pairings is returned as 409 needsDecision.
export async function POST(req: NextRequest) {
  const body = await readJson<{ eventId?: string; courts?: unknown; order?: unknown }>(req)
  if (!body) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  const denied = await adminGuard()
  if (denied) return denied

  const eventId = body.eventId?.trim()
  if (!eventId) return NextResponse.json({ error: 'Missing eventId.' }, { status: 400 })
  const courts = parseCourts(body.courts)
  if (courts === null) return NextResponse.json({ error: 'Courts must be a whole number between 1 and 20.' }, { status: 400 })
  const order = body.order
  if (order !== undefined && (!Array.isArray(order) || !order.every(id => typeof id === 'string'))) {
    return NextResponse.json({ error: 'Invalid order.' }, { status: 400 })
  }

  const state = await loadTAEvent(eventId)
  if ('error' in state) return NextResponse.json({ error: state.error }, { status: state.status })
  const { format, teamIds, matches } = state

  const decision = finalsDecision(eventId, teamIds, matches, format.groupRounds, order as string[] | undefined)
  if (decision.status === 'exists') return NextResponse.json({ error: 'Finals already generated.' }, { status: 409 })
  if (decision.status === 'not-ready') return NextResponse.json({ error: decision.reason }, { status: 400 })
  if (decision.status === 'needs-decision') {
    return NextResponse.json(
      { error: 'Teams are tied after head-to-head — confirm the order first.', needsDecision: true },
      { status: 409 }
    )
  }
  if (decision.pairings.length > courts) {
    return NextResponse.json(
      { error: `Finals need ${decision.pairings.length} courts at the same time, but only ${courts} are set.` },
      { status: 400 }
    )
  }

  const res = await insertFinals(eventId, format, decision.pairings)
  if (res === 'exists') return NextResponse.json({ error: 'Finals already generated.' }, { status: 409 })
  if (typeof res === 'object') return NextResponse.json({ error: res.error }, { status: 500 })
  return NextResponse.json({ success: true })
}
