import Link from 'next/link'
import { Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SkillBadge } from '@/components/ui/badge'

/** Score card shown after the quiz (and when it was already completed). */
export function QuizResult({ eyebrow, title, subtitle, score, level }: { eyebrow: string; title: string; subtitle?: string; score: number; level: string }) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pb-10 pt-6 md:pt-10">
      <p className="text-overline font-semibold uppercase text-primary-text">{eyebrow}</p>
      <h1 className="mt-1 font-display text-[36px] font-bold leading-none">{title}</h1>
      {subtitle && <p className="mt-2 text-[17px] text-foreground/80">{subtitle}</p>}
      <Card className="mt-6 p-6 text-center">
        <p className="text-overline font-semibold uppercase text-subtle">Your rating</p>
        <p className="mt-2 font-display text-[72px] font-bold leading-none tabular">{score}</p>
        <div className="mt-4 flex justify-center">
          <SkillBadge level={level} variant="solid" size="md" dot />
        </div>
        <p className="mt-5 text-sm text-muted-foreground">Higher ratings are earned through tournament wins!</p>
      </Card>
      <Button asChild size="lg" block className="mt-5">
        <Link href="/leaderboard">
          <Trophy />
          View leaderboard
        </Link>
      </Button>
      <Button asChild variant="ghost" block className="mt-2">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </main>
  )
}
