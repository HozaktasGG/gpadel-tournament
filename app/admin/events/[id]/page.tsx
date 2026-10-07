import { notFound, redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import EventAdmin from './event-admin'
import type { AdminEvent, AdminProfile, AdminRegistration, AdminTeam } from './types'

export const dynamic = 'force-dynamic'

export default async function AdminEventPage({ params }: { params: { id: string } }) {
  try {
    await requireAdmin()
  } catch {
    redirect('/signin?error=admin_required&redirect=/admin')
  }

  const eventId = params.id

  const { data: event } = await supabaseAdmin
    .from('events')
    .select('id, name, date, time, location, max_players, entry_fee, description, format, status, image_url, pdf_url, registration_open, featured, subtitle')
    .eq('id', eventId)
    .maybeSingle<AdminEvent>()
  if (!event) notFound()

  const [regsRes, teamsRes, profilesRes, tournamentsRes, groupsRes, teamMatchesRes] = await Promise.all([
    supabaseAdmin
      .from('event_registrations')
      .select('id, user_id, status, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('team_registrations')
      .select('id, team_name, captain_id, partner_id, status, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, email, player_code, skill_level, skill_score, avatar_url')
      .order('first_name', { ascending: true }),
    supabaseAdmin.from('tournaments').select('id').eq('event_id', eventId),
    supabaseAdmin.from('team_tournament_groups').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    supabaseAdmin.from('team_tournament_matches').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
  ])

  let individualFixtures = 0
  const tournamentIds = (tournamentsRes.data ?? []).map(t => t.id as string)
  if (tournamentIds.length > 0) {
    const [rounds, matches] = await Promise.all([
      supabaseAdmin.from('tournament_rounds').select('id', { count: 'exact', head: true }).in('tournament_id', tournamentIds),
      supabaseAdmin.from('tournament_matches').select('id', { count: 'exact', head: true }).in('tournament_id', tournamentIds),
    ])
    individualFixtures = (rounds.count ?? 0) + (matches.count ?? 0)
  }
  const hasFixtures = individualFixtures + (groupsRes.count ?? 0) + (teamMatchesRes.count ?? 0) > 0

  return (
    <EventAdmin
      event={event}
      registrations={(regsRes.data ?? []) as AdminRegistration[]}
      teams={(teamsRes.data ?? []) as AdminTeam[]}
      profiles={(profilesRes.data ?? []) as AdminProfile[]}
      hasFixtures={hasFixtures}
    />
  )
}
