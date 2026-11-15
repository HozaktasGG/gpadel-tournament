import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { applyLightsOutPoints, lightsOutRoute, loError } from '@/lib/lights-out-server'

// Rolls back any applied points, then deletes the draw, the final and the settings.
export async function POST(req: Request) {
  return lightsOutRoute<{ eventId?: string }>(req, async (_body, state) => {
    if (state.tournament) {
      const rolledBack = await applyLightsOutPoints(state, [], [])
      if ('error' in rolledBack) return loError(rolledBack.error, 500)
    }
    const { error: matchErr } = await supabaseAdmin.from('team_tournament_matches').delete().eq('event_id', state.eventId)
    if (matchErr) return loError('Reset failed: ' + matchErr.message, 500)
    const { error: rowErr } = await supabaseAdmin.from('lights_out_tournaments').delete().eq('event_id', state.eventId)
    if (rowErr) return loError('Reset failed: ' + rowErr.message, 500)
    return NextResponse.json({ success: true })
  })
}
