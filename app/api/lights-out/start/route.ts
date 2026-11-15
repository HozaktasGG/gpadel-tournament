import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { drawIsCurrent, drawMatchesOf, finalMatchesOf } from '@/lib/lights-out'
import { lightsOutRoute, loError } from '@/lib/lights-out-server'

// started: true  → lock the draw (the event has started; no more re-draws).
// started: false → unlock again, only while no final has been entered.
export async function POST(req: Request) {
  return lightsOutRoute<{ eventId?: string; started?: unknown }>(req, async (body, state) => {
    if (typeof body.started !== 'boolean') return loError('Invalid request.', 400)
    const { tournament } = state
    if (!tournament) return loError('Run the draw first.', 400)

    if (body.started) {
      const draw = drawMatchesOf(state.matches)
      if (draw.length !== tournament.courts || !drawIsCurrent(draw, state.teamIds)) {
        return loError('The draw no longer matches the approved teams — re-draw first.', 409)
      }
    } else if (finalMatchesOf(state.matches).length > 0 || tournament.points_applied_at) {
      return loError('The final has already been entered, so the draw cannot be unlocked. Reset the tournament instead.', 409)
    }

    const { error } = await supabaseAdmin
      .from('lights_out_tournaments')
      .update({
        started_at: body.started ? tournament.started_at ?? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('event_id', state.eventId)
    if (error) return loError('Update failed: ' + error.message, 500)
    return NextResponse.json({ success: true })
  })
}
