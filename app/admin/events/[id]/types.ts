export type AdminEvent = {
  id: string
  name: string
  date: string
  time: string | null
  location: string | null
  max_players: number | null
  entry_fee: number | null
  description: string | null
  format: string | null
  status: string
  image_url: string | null
  pdf_url: string | null
  registration_open: boolean
}

export type AdminRegistration = {
  id: string
  user_id: string
  status: string
  created_at: string
}

export type AdminTeam = {
  id: string
  team_name: string
  captain_id: string
  partner_id: string | null
  status: 'pending_partner' | 'pending_approval' | 'approved' | 'rejected'
  created_at: string
}

export type AdminProfile = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  player_code: string | null
  skill_level: string | null
  avatar_url: string | null
}

export { TEAM_FORMATS, isTeamFormat } from '@/lib/event-format'

export function fullName(p: Pick<AdminProfile, 'first_name' | 'last_name' | 'email'> | null | undefined) {
  if (!p) return 'Unknown player'
  return [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || p.email || 'Unnamed'
}

// Case- and accent-insensitive key, incl. Turkish letters (ı, İ, ş, ğ, ç, ö, ü).
export function searchKey(s: string | null | undefined) {
  return (s ?? '')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}
