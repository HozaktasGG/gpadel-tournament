import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { drawCourts, finalMatchesOf, validCourts } from '@/lib/lights-out'
import { lightsOutRoute, loError } from '@/lib/lights-out-server'

// Random court draw (or re-draw). Saves the court count with it. Allowed until the
// event is started; needs exactly courts × 2 approved teams.
export async function POST(req: Request) {
  return lightsOutRoute<{ eventId?: string; courts?: unknown }>(req, async (body, state) => {
    const courts = body.courts
    if (!validCourts(courts)) return loError('At least 2 courts are needed.', 400)
    if (state.tournament?.started_at) return loError('The event has started — the draw is locked.', 409)
    if (finalMatchesOf(state.matches).length > 0) return loError('The final has already been entered.', 409)

    const result = drawCourts(state.teamIds, courts)
    if ('error' in result) return loError(result.error, 400)

    const { error: upsertErr } = await supabaseAdmin
      .from('lights_out_tournaments')
      .upsert({ event_id: state.eventId, courts, updated_at: new Date().toISOString() }, { onConflict: 'event_id' })
    if (upsertErr) return loError('Saving the court count failed: ' + upsertErr.message, 500)

    const { error: delErr } = await supabaseAdmin
      .from('team_tournament_matches')
      .delete()
      .eq('event_id', state.eventId)
      .eq('phase', 'draw')
    if (delErr) return loError('Clearing the old draw failed: ' + delErr.message, 500)

    const rows = result.draw.map(d => ({
      event_id: state.eventId,
      phase: 'draw',
      round_number: 1,
      team1_id: d.team1_id,
      team2_id: d.team2_id,
      match_order: d.court,
    }))
    const { error: insErr } = await supabaseAdmin.from('team_tournament_matches').insert(rows)
    if (insErr) {
      // 23505 = a second draw was saved at the same moment (double tap / second phone).
      if (insErr.code === '23505') return loError('Another draw was saved at the same time — refresh the page.', 409)
      return loError('Saving the draw failed: ' + insErr.message, 500)
    }
    return NextResponse.json({ success: true, draw: result.draw })
  })
}
