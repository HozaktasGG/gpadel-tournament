import Link from 'next/link'
import { TrendingUp, Trophy, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export const metadata = { title: 'About · SmashTorino' }

const pillars = [
  { icon: Trophy, title: 'Compete', body: 'Americano and team tournaments, real rankings, friendly rivalry.' },
  { icon: TrendingUp, title: 'Improve', body: 'Track your skill rating and climb from Beginner to Advanced.' },
  { icon: Users, title: 'Connect', body: 'Find regular partners and meet new players every week.' },
]

export default function AboutPage() {
  return (
    <main className="flex-1">
      <section className="relative overflow-hidden">
        <img src="/hero-bg.jpg" alt="" className="absolute inset-0 size-full object-cover opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/85 to-background" />
        <div className="relative mx-auto max-w-3xl px-4 pb-6 pt-10 md:px-8 md:pt-16">
          <p className="text-overline font-semibold uppercase text-foreground/80">Turin padel community</p>
          <h1 className="mt-1 font-display text-[44px] font-bold leading-none md:text-hero-lg">About SmashTorino</h1>
          <p className="mt-2 text-[17px] text-foreground/85">Built by padel players, for padel players.</p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl space-y-5 px-4 pb-12 md:px-8">
        <p className="text-[17px] leading-relaxed text-foreground/85">
          SmashTorino is a grassroots padel community bringing together players of every level around Torino. Our focus is on three things:
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {pillars.map(p => (
            <Card key={p.title} className="p-4">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary-text">
                <p.icon className="size-5" aria-hidden />
              </span>
              <h2 className="mt-3 font-display text-xl font-semibold">{p.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
            </Card>
          ))}
        </div>
        <p className="text-[17px] leading-relaxed text-foreground/85">
          Whether you’ve picked up a racket for the first time or you’re chasing your Advanced badge — there’s a spot on the court for you. Join a tournament, take the
          skill assessment, and introduce yourself to the community.
        </p>
        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          <Button asChild size="lg" className="flex-1">
            <Link href="/tournaments">See tournaments</Link>
          </Button>
          <Button asChild size="lg" variant="secondary" className="flex-1">
            <Link href="/signup">Create account</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
