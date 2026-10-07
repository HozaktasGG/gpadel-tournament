// App-wide constants for the UI. Change values here only.

/** Rating change "this season" is summed from score_history rows on or after this date. */
export const SEASON_START = '2026-10-10'

/** All events happen in Turin; event date/time columns are local Turin time. */
export const EVENT_TIMEZONE = 'Europe/Rome'

/** Events have no end time in the DB; calendar entries use these lengths (minutes) by format. */
export const CALENDAR_DURATION_MIN: Record<string, number> = {
  Americano: 90,
  'Court Americano': 90,
  'Team Americano': 90,
  // Estimate only: group stage + knockout has no standard length (depends on the number of teams).
  Team: 180,
}

/** Fallback for formats not listed above. */
export const CALENDAR_DEFAULT_DURATION_MIN = 90

export function calendarDurationMin(format: string | null | undefined) {
  return (format && CALENDAR_DURATION_MIN[format]) || CALENDAR_DEFAULT_DURATION_MIN
}
