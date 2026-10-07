import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getLevel } from '@/lib/quiz-questions'
import QuizForm from './QuizForm'
import { QuizResult } from './quiz-result'

export const metadata = { title: 'Skill quiz · SmashTorino' }

export default async function QuizPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/signin?redirect=/quiz')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, skill_score, quiz_completed_at, player_code')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.quiz_completed_at) {
    const score = profile.skill_score ?? 0
    const level = getLevel(score)
    return (
      <QuizResult
        eyebrow="Already completed"
        title={`Hi, ${profile.first_name ?? 'there'}!`}
        subtitle="You already completed the quiz."
        score={score}
        level={level}
      />
    )
  }

  const firstName = profile?.first_name ?? user.email?.split('@')[0] ?? 'there'

  return <QuizForm userId={user.id} firstName={firstName} />
}
