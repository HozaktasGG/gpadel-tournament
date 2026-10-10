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

export const TEAM_FORMATS = ['Team', 'Team Americano']

export function isTeamFormat(format: string | null | undefined) {
  return !!format && TEAM_FORMATS.includes(format)
}

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

type NameSource = Pick<AdminProfile, 'first_name' | 'last_name' | 'email'> | null | undefined
export type TeamSlotPlayer = { id: string | null; profile: NameSource }

// First-name token used for auto-generated team names ("<First> & <First>").
export function teamFirstName(p: NameSource) {
  if (!p) return ''
  return p.first_name?.trim() || fullName(p).split(' ')[0]
}

export function autoTeamName(captain: NameSource, partner: NameSource) {
  return [teamFirstName(captain), teamFirstName(partner)].filter(Boolean).join(' & ')
}

// Does a name token refer to this player? Accent/case-insensitive and tolerant of a
// hand-added last initial ("Sarp C."), since older names were typed by hand.
function tokenIsPlayer(token: string, p: NameSource) {
  const first = searchKey(teamFirstName(p)).trim()
  if (!first) return false
  const t = searchKey(token).trim()
  return t === first || t.replace(/\s+\S\.?$/, '') === first
}

// When a team's players change: if the current name is auto-style for the old players,
// returns the name for the new players (unchanged players keep their existing token,
// replaced players get their first name). Returns null for a custom name (keep it).
export function renameForNewPlayers(name: string, old: [TeamSlotPlayer, TeamSlotPlayer], next: [TeamSlotPlayer, TeamSlotPlayer]) {
  const tokens = name.split('&').map(s => s.trim())
  const oldPlayers = old.filter(s => s.id)
  if (tokens.length !== oldPlayers.length || tokens.some(t => !t)) return null

  // Which old slot each token belongs to (captain-first or partner-first order).
  let slotOfToken: number[] | null = null
  if (oldPlayers.length === 1) {
    const slot = old[0].id ? 0 : 1
    if (tokenIsPlayer(tokens[0], old[slot].profile)) slotOfToken = [slot]
  } else if (tokenIsPlayer(tokens[0], old[0].profile) && tokenIsPlayer(tokens[1], old[1].profile)) {
    slotOfToken = [0, 1]
  } else if (tokenIsPlayer(tokens[0], old[1].profile) && tokenIsPlayer(tokens[1], old[0].profile)) {
    slotOfToken = [1, 0]
  }
  if (!slotOfToken) return null

  const tokenFor = (slot: number) => {
    const i = slotOfToken!.indexOf(slot)
    if (i >= 0 && next[slot].id === old[slot].id) return tokens[i]
    return teamFirstName(next[slot].profile)
  }
  const order = slotOfToken.length === 2 ? slotOfToken : [0, 1]
  return order.map(tokenFor).filter(Boolean).join(' & ') || null
}
