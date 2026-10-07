// Formats where players register as fixed pairs (team_registrations).
// Capacity for these counts approved teams × 2.
export const TEAM_FORMATS = ['Team', 'Team Americano']

export function isTeamFormat(format: string | null | undefined) {
  return !!format && TEAM_FORMATS.includes(format)
}
