'use client'

import { useState } from 'react'
import { QUIZ_QUESTIONS, QUIZ_SECTIONS, getLevel, getLevelColor } from '@/lib/quiz-questions'

type Props = { userId: string; firstName: string }

export default function QuizForm({ userId, firstName }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [result, setResult] = useState<{ score: number; level: string } | null>(null)

  const answeredCount = Object.keys(answers).length
  const total = QUIZ_QUESTIONS.length
  const allAnswered = answeredCount === total
  const progress = Math.round((answeredCount / total) * 100)

  const handleSelect = (questionId: string, optionId: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionId }))
  }

  const handleSubmit = async () => {
    if (!allAnswered || submitting) return
    setSubmitting(true)
    setSubmitError('')

    const res = await fetch('/api/quiz/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        answers: QUIZ_QUESTIONS.map(q => ({
          questionId: q.id,
          optionId: answers[q.id],
        })),
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setSubmitting(false)
      setSubmitError(data.error ?? 'Submission failed.')
      return
    }

    setResult({ score: data.score, level: data.level })
    setSubmitting(false)
  }

  if (result) {
    const levelColor = getLevelColor(result.level)
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
                Quiz Completed
              </p>
              <h1 className="text-2xl font-bold text-white mt-2">🎉 Great Job, {firstName}!</h1>
            </div>

            <div className="px-6 py-8 text-center">
              <p className="text-xs tracking-[0.2em] uppercase text-white/50 mb-3">Your Score</p>
              <p className="text-6xl font-bold text-white leading-none">
                {result.score}
                <span className="ml-2 text-xl text-white/40 font-semibold">pts</span>
              </p>
              <div
                className="inline-flex items-center gap-1.5 mt-6 px-5 py-2 rounded-full text-sm font-bold"
                style={{ background: levelColor.bg, color: levelColor.text }}
              >
                {levelColor.icon && <span>{levelColor.icon}</span>}
                <span>{result.level}</span>
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

  return (
    <main className="min-h-screen py-6 px-4 sm:py-10" style={{ backgroundColor: '#1a3d2e' }}>
      <div className="max-w-2xl mx-auto">
        <div className="flex flex-col items-center mb-6">
          <img src="/smashpadel_logo.png" alt="Smash Padel" width={72} height={72} className="rounded-full mb-3" />
          <p className="text-xs tracking-[0.3em] uppercase text-white/60">SmashTorino</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-3 text-center">
            Padel Skill Assessment
          </h1>
          <p className="text-sm text-white/70 mt-2 text-center">
            Hi {firstName}, answer {total} questions to get your score out of 1000.
          </p>
        </div>

        {/* Sticky progress */}
        <div
          className="sticky top-0 z-10 -mx-4 px-4 py-3 backdrop-blur"
          style={{ backgroundColor: 'rgba(26,61,46,0.92)' }}
        >
          <p className="text-xs font-semibold tracking-wide text-white/70 mb-2">
            {answeredCount}/{total} answered
          </p>
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
            <div
              className="h-full transition-all duration-300"
              style={{ width: `${progress}%`, backgroundColor: '#ff6b35' }}
            />
          </div>
        </div>

        <div className="mt-6 space-y-8">
          {QUIZ_SECTIONS.map(section => {
            const sectionQs = QUIZ_QUESTIONS.filter(q => q.section === section.id)
            return (
              <div key={section.id}>
                <div className="mb-4 flex items-baseline justify-between">
                  <h2 className="text-lg font-bold text-white">{section.title}</h2>
                  <p className="text-xs text-white/50">max {section.max} pts</p>
                </div>
                <div className="space-y-4">
                  {sectionQs.map(q => {
                    const questionNumber = QUIZ_QUESTIONS.findIndex(x => x.id === q.id) + 1
                    return (
                      <div
                        key={q.id}
                        className="rounded-2xl p-5"
                        style={{ backgroundColor: '#0f2a1f', border: '1px solid rgba(255,255,255,0.08)' }}
                      >
                        <div className="flex items-start gap-3 mb-4">
                          <div
                            className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{
                              backgroundColor: answers[q.id] ? '#ff6b35' : 'rgba(255,255,255,0.08)',
                              color: '#fff',
                            }}
                          >
                            {questionNumber}
                          </div>
                          <p className="text-sm sm:text-base font-semibold text-white leading-snug">{q.title}</p>
                        </div>
                        <div className="space-y-2">
                          {q.options.map(opt => {
                            const selected = answers[q.id] === opt.id
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => handleSelect(q.id, opt.id)}
                                className="w-full text-left px-4 py-3 rounded-xl text-sm transition-all"
                                style={{
                                  backgroundColor: selected ? 'rgba(255,107,53,0.12)' : 'rgba(255,255,255,0.04)',
                                  border: selected ? '1.5px solid #ff6b35' : '1.5px solid rgba(255,255,255,0.08)',
                                  color: '#fff',
                                }}
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                                    style={{
                                      border: selected ? '2px solid #ff6b35' : '2px solid rgba(255,255,255,0.3)',
                                      backgroundColor: selected ? '#ff6b35' : 'transparent',
                                    }}
                                  >
                                    {selected && (
                                      <svg viewBox="0 0 12 12" width="10" height="10" fill="none">
                                        <path d="M2 6.5L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                    )}
                                  </div>
                                  <span>{opt.label}</span>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {submitError && (
          <p className="mt-6 text-sm text-center text-red-300">{submitError}</p>
        )}

        <div className="mt-8 pb-6">
          <button
            type="button"
            disabled={!allAnswered || submitting}
            onClick={handleSubmit}
            className="w-full py-4 rounded-xl text-base font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#ff6b35' }}
          >
            {submitting
              ? 'Submitting...'
              : allAnswered
                ? 'Submit Quiz'
                : `Answer all ${total} questions (${total - answeredCount} left)`}
          </button>
          <p className="mt-3 text-xs text-center text-white/40">You can only submit once.</p>
        </div>
      </div>
    </main>
  )
}
