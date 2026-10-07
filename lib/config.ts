// App-wide constants for the UI. Change values here only.

/** Rating change "this season" is summed from score_history rows on or after this date. */
export const SEASON_START = '2026-10-10'

/** All events happen in Turin; event date/time columns are local Turin time. */
export const EVENT_TIMEZONE = 'Europe/Rome'

/** Events have no end time in the DB; calendar entries use this length. */
export const CALENDAR_DEFAULT_DURATION_MIN = 120
