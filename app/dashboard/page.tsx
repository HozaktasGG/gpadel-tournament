import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getLevel, getLevelColor } from '@/lib/quiz-questions'
import TeamInvitesSection from './team-invites-section'

type Profile = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  avatar_url: string | null
  skill_score: number | null
  skill_level: string | null
  quiz_completed_at: string | null
  last_score_change: number | null
}

type EventRow = {
  id: string
  name: string
  date: string
  time: string | null
  location: string | null
  status: string
}

type RegistrationRow = {
  id: string
  event_id: string
  status: string
  events: EventRow | null
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
    })
  } catch {
    return dateStr
  }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/signin?redirect=/dashboard')

  const { data: profileData } = await supabase
    .from('profiles')
    .select(
      'id, first_name, last_name, email, phone, avatar_url, skill_score, skill_level, quiz_completed_at, last_score_change'
    )
    .eq('id', user.id)
    .maybeSingle()
  const profile = profileData as Profile | null

  const { data: regData } = await supabase
    .from('event_registrations')
    .select(
      'id, event_id, status, events(id, name, date, time, location, status)'
    )
    .eq('user_id', user.id)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
  const registrations = (regData ?? []) as unknown as RegistrationRow[]

  const todayStr = todayString()
  const upcoming = registrations.filter(
    r => r.events && r.events.date >= todayStr
  )
  const past = registrations.filter(
    r => r.events && r.events.date < todayStr
  )

  const score = profile?.skill_score ?? 0
  const quizDone = !!profile?.quiz_completed_at
  const level = quizDone ? getLevel(score) : '—'
  const levelColor = quizDone ? getLevelColor(level) : null

  let rank: number | null = null
  if (quizDone) {
    const { count: higherCount } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .not('skill_score', 'is', null)
      .gt('skill_score', score)
    rank = (higherCount ?? 0) + 1
  }

  const firstName = profile?.first_name ?? user.email?.split('@')[0] ?? 'player'

  return (
    <main
      className="flex-1 py-10 px-4 sm:px-6"
      style={{ backgroundColor: '#1a3d2e' }}
    >
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              width={64}
              height={64}
              className="rounded-full object-cover flex-shrink-0"
              style={{ width: 64, height: 64 }}
            />
          ) : (
            <span
              className="flex-shrink-0 flex items-center justify-center rounded-full text-xl font-bold text-white"
              style={{ width: 64, height: 64, backgroundColor: '#ff6b35' }}
            >
              {firstName[0]?.toUpperCase() ?? '?'}
            </span>
          )}
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white">
              Welcome back, <span style={{ color: '#ff6b35' }}>{firstName}</span>!
            </h1>
            <p className="text-sm text-white/60 mt-1">
              Here's your SmashTorino overview.
            </p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Skill Score"
            value={quizDone ? String(score) : '—'}
            suffix={quizDone ? 'pts' : ''}
          />
          <StatCard
            label="Level"
            value={level}
            badge={levelColor ?? undefined}
          />
          <StatCard label="Rank" value={rank != null ? `#${rank}` : '—'} />
          <StatCard
            label="Tournaments"
            value={String(registrations.length)}
            suffix="joined"
          />
        </div>

        {!quizDone && (
          <div
            className="mt-8 rounded-2xl p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-4"
            style={{
              background:
                'linear-gradient(135deg, rgba(255,107,53,0.15), rgba(255,107,53,0.04))',
              border: '1px solid rgba(255,107,53,0.25)',
            }}
          >
            <div className="flex-1">
              <p
                className="text-xs tracking-[0.2em] uppercase font-semibold"
                style={{ color: '#ff6b35' }}
              >
                Get Started
              </p>
              <h2 className="text-lg font-bold text-white mt-1">
                Take the skill assessment
              </h2>
              <p className="text-sm text-white/70 mt-1">
                16 questions, ~3 minutes. Earn a score and unlock the leaderboard.
              </p>
            </div>
            <Link
              href="/quiz"
              className="flex-shrink-0 px-6 py-3 rounded-full text-sm font-bold text-white text-center"
              style={{ backgroundColor: '#ff6b35' }}
            >
              Take Skill Quiz →
            </Link>
          </div>
        )}

        {profile?.last_score_change != null && profile.last_score_change !== 0 && (
          <div
            className="mt-6 rounded-xl p-4 flex items-center justify-between"
            style={{
              backgroundColor: '#0f2a1f',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div>
              <p className="text-xs text-white/50 font-semibold uppercase tracking-wide">
                Recent score change
              </p>
              <p className="text-sm text-white/80 mt-0.5">
                Your last tournament result
              </p>
            </div>
            <span
              className="px-3 py-1.5 rounded-full text-sm font-bold"
              style={{
                backgroundColor:
                  profile.last_score_change > 0
                    ? 'rgba(34,197,94,0.15)'
                    : 'rgba(239,68,68,0.15)',
                color: profile.last_score_change > 0 ? '#22c55e' : '#f87171',
              }}
            >
              {profile.last_score_change > 0 ? '▲ +' : '▼ '}
              {profile.last_score_change}
            </span>
          </div>
        )}

        <section className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Upcoming Tournaments</h2>
            <Link
              href="/tournaments"
              className="text-sm font-semibold"
              style={{ color: '#ff6b35' }}
            >
              Browse all →
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <div
              className="rounded-2xl p-8 text-center"
              style={{
                backgroundColor: '#0f2a1f',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <p className="text-sm text-white/70">
                You're not signed up for any upcoming tournaments yet.
              </p>
              <Link
                href="/tournaments"
                className="inline-block mt-3 text-sm font-semibold"
                style={{ color: '#ff6b35' }}
              >
                Find one →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map(r => (
                <Link
                  key={r.id}
                  href={`/tournaments/${r.event_id}`}
                  className="block rounded-xl p-4 sm:p-5 transition hover:bg-white/[0.04]"
                  style={{
                    backgroundColor: '#0f2a1f',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-base font-bold text-white">
                        {r.events?.name}
                      </p>
                      <p className="text-xs text-white/60 mt-1">
                        {r.events && formatDateLabel(r.events.date)}
                        {r.events?.time && ` · ${r.events.time}`}
                        {r.events?.location && ` · ${r.events.location}`}
                      </p>
                    </div>
                    <span
                      className="text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded-full flex-shrink-0 ml-3"
                      style={{
                        backgroundColor:
                          r.events?.status === 'active'
                            ? 'rgba(34,197,94,0.15)'
                            : 'rgba(34,197,94,0.15)',
                        color: '#22c55e',
                      }}
                    >
                      {r.events?.status === 'active' ? '● Live' : 'Registered'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <TeamInvitesSection userId={user.id} userPhone={profile?.phone ?? null} />

        {past.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-bold text-white mb-4">Past Tournaments</h2>
            <div className="space-y-3">
              {past.map(r => (
                <Link
                  key={r.id}
                  href={`/tournaments/${r.event_id}`}
                  className="block rounded-xl p-4 sm:p-5 transition hover:bg-white/[0.04]"
                  style={{
                    backgroundColor: '#0f2a1f',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-base font-semibold text-white/90">
                        {r.events?.name}
                      </p>
                      <p className="text-xs text-white/50 mt-1">
                        {r.events && formatDateLabel(r.events.date)}
                      </p>
                    </div>
                    <span
                      className="text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded-full"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.06)',
                        color: 'rgba(255,255,255,0.5)',
                      }}
                    >
                      Finished
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

function StatCard({
  label,
  value,
  suffix,
  badge,
}: {
  label: string
  value: string
  suffix?: string
  badge?: { bg: string; text: string; icon?: string }
}) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        backgroundColor: '#0f2a1f',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <p className="text-[10px] tracking-[0.2em] uppercase font-semibold text-white/50">
        {label}
      </p>
      {badge ? (
        <div
          className="inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full text-sm font-bold"
          style={{ background: badge.bg, color: badge.text }}
        >
          {badge.icon && <span>{badge.icon}</span>}
          <span>{value}</span>
        </div>
      ) : (
        <p className="text-2xl font-bold text-white mt-1 leading-tight">
          {value}
          {suffix && (
            <span className="text-xs text-white/40 font-semibold ml-1">
              {suffix}
            </span>
          )}
        </p>
      )}
    </div>
  )
}
