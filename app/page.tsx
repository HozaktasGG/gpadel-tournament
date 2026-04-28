import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { getLevel, getLevelColor } from '@/lib/quiz-questions'

type EventRow = {
  id: string
  name: string
  date: string
  time: string | null
  location: string | null
  max_players: number | null
  format: string | null
  status: string
  entry_fee: number | null
  description: string | null
}

type LeaderRow = {
  id: string
  first_name: string | null
  last_name: string | null
  skill_score: number | null
}

function todayString() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

function formatDateLabel(dateStr: string) {
  try {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function maskName(first: string | null, last: string | null) {
  const f = first ?? ''
  const l = last ? last.charAt(0) + '.' : ''
  return `${f} ${l}`.trim() || 'Player'
}

export default async function HomePage() {
  const supabase = await createClient()
  const todayStr = todayString()

  const [{ data: events }, { data: leaders }] = await Promise.all([
    supabase
      .from('events')
      .select('*')
      .gte('date', todayStr)
      .order('date', { ascending: true })
      .limit(3),
    supabase
      .from('profiles')
      .select('id, first_name, last_name, skill_score')
      .not('skill_score', 'is', null)
      .gt('skill_score', 0)
      .order('skill_score', { ascending: false })
      .limit(5),
  ])

  const upcomingEvents = (events ?? []) as EventRow[]
  const leaderRows = (leaders ?? []) as LeaderRow[]

  const eventCounts = await Promise.all(
    upcomingEvents.map(async ev => {
      const { count } = await supabase
        .from('event_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', ev.id)
        .eq('status', 'approved')
      return { id: ev.id, count: count ?? 0 }
    })
  )
  const countByEvent = Object.fromEntries(eventCounts.map(c => [c.id, c.count]))

  return (
    <main>
      {/* Hero */}
      <section className="relative min-h-[600px] flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/hero-bg.jpg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a3d2e]/85 via-[#1a3d2e]/70 to-[#1a3d2e]" />
        <div className="relative z-10 text-center px-4 max-w-6xl mx-auto sm:px-6 py-20 sm:py-28">
          <p
            className="text-xs sm:text-sm tracking-[0.3em] uppercase font-semibold mb-4"
            style={{ color: '#ff6b35' }}
          >
            🎾 Torino's Padel Community
          </p>
          <h1 className="text-4xl sm:text-6xl font-bold text-white leading-tight">
            Welcome to <span style={{ color: '#ff6b35' }}>SmashTorino</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-white/75 max-w-2xl mx-auto leading-relaxed">
            Compete in Americano tournaments, track your skill progression, and
            connect with padel players across the city.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/tournaments"
              className="w-full sm:w-auto px-8 py-3.5 rounded-full text-sm font-bold text-white transition hover:brightness-110 hover:scale-[1.02]"
              style={{ backgroundColor: '#ff6b35' }}
            >
              Join Next Tournament →
            </Link>
            <Link
              href="/leaderboard"
              className="w-full sm:w-auto px-8 py-3.5 rounded-full text-sm font-semibold text-white transition hover:bg-white/10"
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              🏆 View Leaderboard
            </Link>
          </div>
        </div>
      </section>

      {/* Upcoming tournaments */}
      <section className="py-16 sm:py-20" style={{ backgroundColor: '#1a3d2e' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-end justify-between mb-8">
            <div>
              <p
                className="text-xs tracking-[0.3em] uppercase font-semibold mb-2"
                style={{ color: '#ff6b35' }}
              >
                What's Next
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">
                Upcoming Tournaments
              </h2>
            </div>
            <Link
              href="/tournaments"
              className="hidden sm:inline text-sm font-semibold text-white/70 hover:text-white"
            >
              View all →
            </Link>
          </div>

          {upcomingEvents.length === 0 ? (
            <div
              className="rounded-2xl p-10 text-center"
              style={{
                backgroundColor: '#0f2a1f',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <p className="text-sm text-white/70">
                No tournaments scheduled right now — check back soon!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {upcomingEvents.map(ev => (
                <Link
                  key={ev.id}
                  href={`/tournaments/${ev.id}`}
                  className="block rounded-2xl p-6 transition hover:-translate-y-1"
                  style={{
                    backgroundColor: '#0f2a1f',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <span
                      className="text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded-full"
                      style={{
                        backgroundColor:
                          ev.status === 'active'
                            ? 'rgba(34,197,94,0.15)'
                            : 'rgba(255,107,53,0.15)',
                        color: ev.status === 'active' ? '#22c55e' : '#ff6b35',
                      }}
                    >
                      {ev.status === 'active' ? '● Live' : 'Upcoming'}
                    </span>
                    {ev.format && (
                      <span className="text-[10px] text-white/40 font-semibold">
                        {ev.format}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-white leading-snug">
                    {ev.name}
                  </h3>
                  <div className="mt-4 space-y-1.5 text-sm text-white/70">
                    <p>📅 {formatDateLabel(ev.date)}</p>
                    {ev.time && <p>🕐 {ev.time}</p>}
                    {ev.location && <p>📍 {ev.location}</p>}
                  </div>
                  <div
                    className="mt-5 pt-4"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <p className="text-xs text-white/70 font-semibold mb-3">
                      {countByEvent[ev.id] ?? 0} / {ev.max_players ?? 0} Spots Filled
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/50">
                        {ev.entry_fee ? `€${ev.entry_fee}` : 'Free'}
                      </span>
                      <span
                        className="text-xs font-bold"
                        style={{ color: '#ff6b35' }}
                      >
                        Register →
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Leaderboard preview */}
      <section
        className="py-16 sm:py-20"
        style={{ backgroundColor: '#0f2a1f' }}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <p
              className="text-xs tracking-[0.3em] uppercase font-semibold mb-2"
              style={{ color: '#ff6b35' }}
            >
              Top Players
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Community Leaderboard
            </h2>
            <p className="text-sm text-white/60 mt-2">
              Earn points by completing the skill quiz and winning tournaments.
            </p>
          </div>

          {leaderRows.length === 0 ? (
            <div
              className="rounded-2xl p-8 text-center"
              style={{
                backgroundColor: '#1a3d2e',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <p className="text-sm text-white/70 mb-4">
                Be the first to take the skill assessment!
              </p>
              <Link
                href="/signup"
                className="inline-block px-5 py-2.5 rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: '#ff6b35' }}
              >
                Sign Up
              </Link>
            </div>
          ) : (
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                backgroundColor: '#1a3d2e',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {leaderRows.map((row, idx) => {
                const rank = idx + 1
                const score = row.skill_score ?? 0
                const level = getLevel(score)
                const color = getLevelColor(level)
                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : ''
                return (
                  <div
                    key={row.id}
                    className="flex items-center gap-4 px-5 py-4 border-b last:border-b-0"
                    style={{ borderColor: 'rgba(255,255,255,0.06)' }}
                  >
                    <div className="flex-shrink-0 w-8 text-center">
                      {medal ? (
                        <span className="text-xl">{medal}</span>
                      ) : (
                        <span className="text-sm font-bold text-white/50">
                          {rank}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {maskName(row.first_name, row.last_name)}
                      </p>
                      <div
                        className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                        style={{ background: color.bg, color: color.text }}
                      >
                        {color.icon && <span>{color.icon}</span>}
                        <span>{level}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold text-white leading-none">
                        {score}
                      </p>
                      <p className="text-[10px] text-white/40 font-semibold mt-1">
                        pts
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="text-center mt-6">
            <Link
              href="/leaderboard"
              className="text-sm font-semibold"
              style={{ color: '#ff6b35' }}
            >
              View full leaderboard →
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 sm:py-20" style={{ backgroundColor: '#1a3d2e' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Why SmashTorino?
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              {
                icon: '🏆',
                title: 'Compete',
                body: 'Regular Americano tournaments with real rankings and prizes.',
              },
              {
                icon: '📈',
                title: 'Improve',
                body: 'Take the skill quiz, earn an ELO-style score, and climb the ladder.',
              },
              {
                icon: '🤝',
                title: 'Connect',
                body: 'Meet padel players in Torino and build your regular crew.',
              },
            ].map(f => (
              <div
                key={f.title}
                className="rounded-2xl p-6 transition hover:-translate-y-1"
                style={{
                  backgroundColor: '#0f2a1f',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-white/65 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section
        className="py-16 sm:py-20"
        style={{ backgroundColor: '#0f2a1f' }}
        id="about"
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            About SmashTorino
          </h2>
          <p className="text-sm sm:text-base text-white/70 leading-relaxed">
            SmashTorino is a grassroots padel community bringing together
            players of every level around Torino. We organise friendly but
            competitive tournaments, track skill progression with data-driven
            assessments, and help newcomers find their regular partners. Whether
            you've picked up a racket for the first time or you're grinding for
            your first Pro badge — there's a spot on the court for you.
          </p>
          <Link
            href="/signup"
            className="inline-block mt-8 px-8 py-3 rounded-full text-sm font-bold text-white transition hover:brightness-110"
            style={{ backgroundColor: '#ff6b35' }}
          >
            Join the Community
          </Link>
        </div>
      </section>
    </main>
  )
}
