import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getLevel, getLevelColor } from '@/lib/quiz-questions'
import QuizForm from './QuizForm'

export default async function QuizPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/signin?redirect=/quiz')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, skill_score, quiz_completed_at')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.quiz_completed_at) {
    const score = profile.skill_score ?? 0
    const level = getLevel(score)
    const levelColor = getLevelColor(level)

    return (
      <main className="min-h-screen py-8 px-4 sm:py-12" style={{ backgroundColor: '#1a3d2e' }}>
        <div className="max-w-md mx-auto">
          <div className="flex flex-col items-center mb-6">
            <img src="/smashpadel_logo.png" alt="Smash Padel" width={72} height={72} className="rounded-full mb-3" />
            <p className="text-xs tracking-[0.3em] uppercase text-white/60">SmashTorino</p>
          </div>

          <div
            className="rounded-3xl overflow-hidden shadow-2xl"
            style={{ backgroundColor: '#0f2a1f', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div
              className="px-6 pt-7 pb-6 text-center"
              style={{ background: 'linear-gradient(180deg, #204a38 0%, #0f2a1f 100%)' }}
            >
              <p className="text-xs tracking-[0.25em] uppercase font-semibold" style={{ color: '#ff6b35' }}>
                Already Completed
              </p>
              <h1 className="text-2xl font-bold text-white mt-2">
                Hi, {profile.first_name ?? 'there'}!
              </h1>
              <p className="text-sm text-white/60 mt-2">You already completed the quiz.</p>
            </div>

            <div className="px-6 py-8 text-center">
              <p className="text-xs tracking-[0.2em] uppercase text-white/50 mb-3">Your Score</p>
              <p className="text-6xl font-bold text-white leading-none">
                {score}
                <span className="ml-2 text-xl text-white/40 font-semibold">pts</span>
              </p>
              <div
                className="inline-flex items-center gap-1.5 mt-6 px-5 py-2 rounded-full text-sm font-bold"
                style={{ background: levelColor.bg, color: levelColor.text }}
              >
                {levelColor.icon && <span>{levelColor.icon}</span>}
                <span>{level}</span>
              </div>
              <p className="mt-6 text-xs text-white/50 leading-relaxed px-2">
                Higher scores are earned through tournament wins!
              </p>
            </div>
          </div>

          <a
            href="/leaderboard"
            className="mt-6 flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
            style={{ backgroundColor: '#ff6b35' }}
          >
            🏆 View Leaderboard
          </a>
          <div className="mt-4 text-center">
            <a href="/dashboard" className="text-xs text-white/50 underline">Back to Dashboard</a>
          </div>
        </div>
      </main>
    )
  }

  const firstName = profile?.first_name ?? user.email?.split('@')[0] ?? 'there'

  return <QuizForm userId={user.id} firstName={firstName} />
}
