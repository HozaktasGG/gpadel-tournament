'use client'

import { useState } from 'react'
import { CalendarDays, ChevronRight, Inbox, Share } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge, FeaturedTag, FormatBadge, LivePill, SkillBadge } from '@/components/ui/badge'
import { Avatar, AvatarPair } from '@/components/ui/avatar'
import { CapacityBar } from '@/components/ui/capacity-bar'
import { PlayerRow } from '@/components/ui/player-row'
import { TeamPairCard } from '@/components/ui/team-pair-card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BottomSheet } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from '@/components/ui/sonner'
import { PlayerRowSkeleton, TournamentCardSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Input, SearchInput } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { FadeUpItem, FlipNumber, Stagger } from '@/components/motion'
import { AddToCalendarButton, ShareEventButton } from '@/components/event-actions'

// Placeholder names only to exercise layouts; no real data.
const sample = ['Player One', 'Player Two', 'Player Three', 'Player Four']

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-overline font-semibold uppercase text-subtle">{title}</h2>
      {children}
    </section>
  )
}

export function UiKit() {
  const [sheet, setSheet] = useState(false)
  const [score, setScore] = useState(14)
  const [on, setOn] = useState(true)

  return (
    <main className="mx-auto w-full max-w-[1200px] space-y-10 px-4 py-8 md:px-8">
      <header>
        <p className="text-overline font-semibold uppercase text-muted-foreground">Turin padel community</p>
        <h1 className="font-display text-hero font-bold md:text-hero-lg">Your next match starts here.</h1>
        <p className="mt-2 text-muted-foreground">UI kit — dev only</p>
      </header>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg">View tournament <ChevronRight /></Button>
          <Button>Register solo</Button>
          <Button variant="secondary">Decline</Button>
          <Button variant="subtle">Edit pair</Button>
          <Button variant="ghost"><Share />Share this event</Button>
          <Button variant="danger" size="sm">Remove</Button>
          <Button variant="link">View all</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap items-center gap-2">
          <FeaturedTag />
          <FormatBadge format="Americano" />
          <FormatBadge format="Team" />
          <FormatBadge format="Team Americano" />
          <LivePill />
          <Badge variant="success">Registered · Solo</Badge>
          <Badge>Americano</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {['Unranked', 'Beginner', 'Intermediate', 'Advanced'].map(l => <SkillBadge key={l} level={l} />)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {['Unranked', 'Beginner', 'Intermediate', 'Advanced'].map(l => <SkillBadge key={l} level={l} variant="solid" size="md" dot />)}
        </div>
      </Section>

      <Section title="Avatars (initials fallback)">
        <div className="flex flex-wrap items-center gap-3">
          {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((s, i) => <Avatar key={s} name={sample[i % 4]} size={s} />)}
          <AvatarPair a={{ name: sample[0] }} b={{ name: sample[1] }} size="md" />
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Section title="Capacity">
          <Card className="space-y-6 p-4">
            <CapacityBar filled={16} capacity={20} />
            <CapacityBar filled={6} capacity={10} unit="teams" />
            <CapacityBar filled={16} capacity={20} tone="primary" layout="detailed" />
            <CapacityBar filled={20} capacity={20} tone="primary" layout="detailed" />
          </Card>
        </Section>

        <Section title="Player rows">
          <Stagger className="space-y-2">
            {[1, 2, 3, 4].map((r, i) => (
              <FadeUpItem key={r}>
                <PlayerRow rank={r} name={sample[i]} skillLevel={['Advanced', 'Advanced', 'Intermediate', 'Beginner'][i]} rating={1420 - i * 40} href="#" />
              </FadeUpItem>
            ))}
          </Stagger>
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Section title="Team pair">
          <TeamPairCard
            teamName="Team name"
            captain={{ name: sample[0], skillLevel: 'Intermediate', rating: 1240 }}
            partner={{ name: sample[1], skillLevel: 'Intermediate', rating: 1210 }}
          />
          <TeamPairCard captain={{ name: sample[2], skillLevel: 'Beginner' }} partner={null} />
        </Section>

        <Section title="Tabs">
          <Tabs defaultValue="upcoming">
            <TabsList variant="pill">
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="live">Live</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
            </TabsList>
            <TabsContent value="upcoming"><p className="text-sm text-muted-foreground">Upcoming content</p></TabsContent>
            <TabsContent value="live"><p className="text-sm text-muted-foreground">Live content</p></TabsContent>
            <TabsContent value="completed"><p className="text-sm text-muted-foreground">Completed content</p></TabsContent>
          </Tabs>
          <Tabs defaultValue="players">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="players">Players</TabsTrigger>
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
            </TabsList>
          </Tabs>
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Section title="Overlays + toast + score flip">
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setSheet(true)}>Open bottom sheet</Button>
            <Dialog>
              <DialogTrigger asChild><Button variant="secondary">Open dialog</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Leave this team?</DialogTitle>
                  <DialogDescription>Your partner will be notified.</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="secondary">Cancel</Button>
                  <Button>Confirm</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="subtle" onClick={() => toast.success('Link copied', { description: 'Share it with your partner.' })}>Toast</Button>
            <ShareEventButton title="Sample event" url="/tournaments" />
            <AddToCalendarButton event={{ id: 'ui-kit-sample', name: 'Sample event', format: 'Americano', date: '2026-10-10', time: '18:30', location: 'Sample venue, Turin', url: '/tournaments' }} />
          </div>
          <Card className="flex items-center justify-between p-4">
            <span className="font-display text-score font-bold"><FlipNumber value={score} /> : 10</span>
            <Button size="sm" variant="subtle" onClick={() => setScore(s => s + 1)}>+1</Button>
          </Card>
        </Section>

        <Section title="Form controls (16px inputs)">
          <SearchInput placeholder="Search by player code, e.g. SMASH-1234" />
          <Input placeholder="Email" type="email" />
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-3 text-sm"><Switch checked={on} onCheckedChange={setOn} /> Registration open</label>
            <label className="flex items-center gap-3 text-sm"><Checkbox defaultChecked /> Selected</label>
            <label className="flex items-center gap-3 text-sm"><Checkbox round /> Round</label>
          </div>
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Section title="Skeletons">
          <TournamentCardSkeleton />
          <PlayerRowSkeleton />
        </Section>
        <Section title="Empty state">
          <EmptyState icon={Inbox} title="No upcoming events" description="New tournaments are announced every week." action={<Button variant="secondary"><CalendarDays />Browse tournaments</Button>} />
          <Card>
            <CardHeader><CardTitle>Card title</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">Card body text on the card surface.</p></CardContent>
          </Card>
        </Section>
      </div>

      <BottomSheet
        open={sheet}
        onOpenChange={setSheet}
        title="Add player"
        footer={<Button block size="lg" onClick={() => setSheet(false)}>Add selected player</Button>}
      >
        <SearchInput placeholder="Search players…" className="mb-3" />
        <div className="space-y-2">
          {sample.map((n, i) => (
            <PlayerRow key={n} name={n} meta={`SMASH-000${i}`} skillLevel={['Beginner', 'Intermediate', 'Unranked', 'Advanced'][i]} trailing={<Checkbox round aria-label={`Select ${n}`} />} />
          ))}
        </div>
      </BottomSheet>
    </main>
  )
}
