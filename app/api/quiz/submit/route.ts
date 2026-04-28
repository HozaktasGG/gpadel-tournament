import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { QUIZ_QUESTIONS, getLevel } from '@/lib/quiz-questions'

type AnswerPayload = {
  questionId: string
  optionId: string
}

export async function POST(req: NextRequest) {
  let body: { userId?: string; answers?: AnswerPayload[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { userId, answers } = body
  if (!userId || !Array.isArray(answers)) {
    return NextResponse.json({ error: 'Missing userId or answers.' }, { status: 400 })
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, quiz_completed_at')
    .eq('id', userId)
    .maybeSingle()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 })
  }

  if (profile.quiz_completed_at) {
    return NextResponse.json({ error: 'Quiz already completed.' }, { status: 409 })
  }

  let totalScore = 0
  const normalized: Array<{ questionId: string; optionId: string; score: number }> = []

  for (const q of QUIZ_QUESTIONS) {
    const answer = answers.find(a => a.questionId === q.id)
    if (!answer) {
      return NextResponse.json({ error: `Missing answer for ${q.id}.` }, { status: 400 })
    }
    const option = q.options.find(o => o.id === answer.optionId)
    if (!option) {
      return NextResponse.json({ error: `Invalid option for ${q.id}.` }, { status: 400 })
    }
    totalScore += option.score
    normalized.push({ questionId: q.id, optionId: option.id, score: option.score })
  }

  const level = getLevel(totalScore)

  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({
      skill_score: totalScore,
      skill_level: level,
      quiz_completed_at: new Date().toISOString(),
      quiz_answers: normalized,
    })
    .eq('id', userId)

  if (updateError) {
    return NextResponse.json({ error: 'Could not save your quiz. Please try again.' }, { status: 500 })
  }

  await supabaseAdmin.from('score_history').insert({
    user_id: userId,
    score: totalScore,
    change: totalScore,
    reason: 'quiz',
  })

  return NextResponse.json({ score: totalScore, level })
}
