'use client'

import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { QUIZ_QUESTIONS, QUIZ_SECTIONS } from '@/lib/quiz-questions'
import { Button } from '@/components/ui/button'
import { QuizResult } from './quiz-result'

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
    return <QuizResult eyebrow="Quiz completed" title={`Great job, ${firstName}!`} score={result.score} level={result.level} />
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-10 pt-6 md:pt-10">
      <p className="text-overline font-semibold uppercase text-muted-foreground">Skill assessment</p>
      <h1 className="mt-1 font-display text-[40px] font-bold leading-none md:text-hero">Padel skill quiz</h1>
      <p className="mt-2 text-[17px] text-foreground/80">
        Hi {firstName}, answer {total} questions to get your rating out of 1000.
      </p>

      {/* Sticky progress, just under the site header */}
      <div className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-10 -mx-4 mt-4 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md md:top-[calc(72px+env(safe-area-inset-top))]">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">
            {answeredCount}/{total} answered
          </span>
          <span className="text-muted-foreground tabular">{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/[0.12]" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={answeredCount} aria-label="Quiz progress">
          <div className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="mt-6 space-y-8">
        {QUIZ_SECTIONS.map(section => {
          const sectionQs = QUIZ_QUESTIONS.filter(q => q.section === section.id)
          return (
            <section key={section.id} aria-labelledby={`sec-${section.id}`}>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 id={`sec-${section.id}`} className="font-display text-2xl font-semibold">
                  {section.title}
                </h2>
                <p className="text-xs text-subtle">max {section.max} pts</p>
              </div>
              <div className="space-y-3">
                {sectionQs.map(q => {
                  const questionNumber = QUIZ_QUESTIONS.findIndex(x => x.id === q.id) + 1
                  const answered = !!answers[q.id]
                  return (
                    <fieldset key={q.id} className="rounded-2xl border border-border bg-card p-4 shadow-card md:p-5">
                      <legend className="sr-only">{q.title}</legend>
                      <div className="mb-3 flex items-start gap-3">
                        <span
                          aria-hidden
                          className={`flex size-7 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold ${answered ? 'bg-primary text-primary-foreground' : 'bg-white/[0.08] text-muted-foreground'}`}
                        >
                          {questionNumber}
                        </span>
                        <p className="text-[16px] font-semibold leading-snug">{q.title}</p>
                      </div>
                      <div className="space-y-2" role="radiogroup" aria-label={q.title}>
                        {q.options.map(opt => {
                          const selected = answers[q.id] === opt.id
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              onClick={() => handleSelect(q.id, opt.id)}
                              className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-[15px] transition-colors ${
                                selected ? 'border-primary bg-primary/10' : 'border-border bg-pitch-850 hover:bg-pitch-800 active:bg-pitch-700'
                              }`}
                            >
                              <span
                                aria-hidden
                                className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-white/30'}`}
                              >
                                {selected && <Check className="size-3" strokeWidth={3.5} />}
                              </span>
                              <span>{opt.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    </fieldset>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      {submitError && (
        <p role="alert" className="mt-6 rounded-xl bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
          {submitError}
        </p>
      )}

      <div className="mt-8">
        <Button size="lg" block disabled={!allAnswered || submitting} onClick={handleSubmit}>
          {submitting && <Loader2 className="animate-spin" />}
          {submitting ? 'Submitting…' : allAnswered ? 'Submit quiz' : `Answer all ${total} questions (${total - answeredCount} left)`}
        </Button>
        <p className="mt-3 text-center text-xs text-subtle">You can only submit once.</p>
      </div>
    </main>
  )
}
