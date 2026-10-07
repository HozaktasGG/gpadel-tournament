'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Camera, ChevronRight, ClipboardList, Copy, Info, Loader2, LogOut, Shield, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase-client'
import { getLevel, QUIZ_QUESTIONS } from '@/lib/quiz-questions'
import { SEASON_START } from '@/lib/config'
import { formatEventDate } from '@/lib/event-status'
import { loadPlayerEvents, loadPlayerResults, type PlayerResult, type TeamStats } from '@/lib/player-results'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { SkillBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { FadeUpItem, Stagger } from '@/components/motion'
import { useSessionProfile } from '@/components/nav/session-context'
import { RatingChart, type ScoreRow } from './rating-chart'


const isQuiz = (reason: string | null) => !!reason && /quiz/i.test(reason)

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const { isAdmin, signOut } = useSessionProfile()

  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [score, setScore] = useState<number | null>(null)
  const [quizCompleted, setQuizCompleted] = useState(false)
  const [phone, setPhone] = useState('')
  // Only send phone on save if we could load it (avoids wiping it on RPC failure).
  const [phoneLoaded, setPhoneLoaded] = useState(false)
  const [playerCode, setPlayerCode] = useState<string | null>(null)

  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarMsg, setAvatarMsg] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')

  const [newPassword, setNewPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState('')

  // Progress data (read-only).
  const [history, setHistory] = useState<ScoreRow[] | null>(null)
  const [results, setResults] = useState<PlayerResult[] | null>(null)
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null)

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/signin?redirect=/profile')
        return
      }
      setUserId(user.id)
      setEmail(user.email ?? '')

      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name, avatar_url, skill_score, quiz_completed_at, player_code')
        .eq('id', user.id)
        .maybeSingle()
      if (data) {
        setFirstName(data.first_name ?? '')
        setLastName(data.last_name ?? '')
        setAvatarUrl(data.avatar_url ?? null)
        setScore(data.skill_score ?? null)
        setQuizCompleted(!!data.quiz_completed_at)
        setPlayerCode(data.player_code ?? null)
      }
      // Contact details are not readable via the public API; fetch our own via RPC.
      const { data: contact, error: contactErr } = await supabase.rpc('get_my_contact').maybeSingle<{ email: string | null; phone: string | null }>()
      if (!contactErr) {
        setPhone(contact?.phone ?? '')
        setPhoneLoaded(true)
      }
      setLoading(false)

      // --- progress (rating history, past events, team results) ---
      const [hist, events] = await Promise.all([
        supabase.from('score_history').select('id, score, change, reason, created_at').eq('user_id', user.id).order('created_at', { ascending: true }),
        loadPlayerEvents(supabase, user.id),
      ])
      setHistory((hist.data ?? []) as ScoreRow[])
      const { results: res, teamStats: stats } = await loadPlayerResults(supabase, events)
      setResults(res)
      setTeamStats(stats)
    }
    load()
  }, [router, supabase])

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return

    if (!file.type.startsWith('image/')) {
      setAvatarMsg('Please select an image file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarMsg('Image must be under 5MB.')
      return
    }

    setUploadingAvatar(true)
    setAvatarMsg('')

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
    const path = `${userId}/avatar.${ext}`

    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (upErr) {
      setUploadingAvatar(false)
      setAvatarMsg(upErr.message)
      return
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('avatars').getPublicUrl(path)
    // Cache-bust so navbar re-fetches the new image
    const urlWithBust = `${publicUrl}?t=${Date.now()}`

    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ avatar_url: urlWithBust, updated_at: new Date().toISOString() })
      .eq('id', userId)

    setUploadingAvatar(false)
    if (profileErr) {
      setAvatarMsg(profileErr.message)
      return
    }
    setAvatarUrl(urlWithBust)
    setAvatarMsg('Avatar updated ✓')
    setTimeout(() => setAvatarMsg(''), 2500)
    router.refresh()
  }

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingProfile(true)
    setProfileMsg('')
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const trimmedPhone = phone.trim()
    console.log('Saving phone:', trimmedPhone)

    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: firstName,
        last_name: lastName,
        ...(phoneLoaded ? { phone: trimmedPhone } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    setSavingProfile(false)
    if (error) {
      setProfileMsg(error.message)
    } else {
      setPhone(trimmedPhone)
      setProfileMsg('Saved ✓')
    }
    setTimeout(() => setProfileMsg(''), 3000)
  }

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 6) {
      setPasswordMsg('Password must be at least 6 characters.')
      return
    }
    setSavingPassword(true)
    setPasswordMsg('')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)
    if (error) {
      setPasswordMsg(error.message)
      return
    }
    setNewPassword('')
    setPasswordMsg('Password updated ✓')
    setTimeout(() => setPasswordMsg(''), 3000)
  }

  const copyCode = async () => {
    if (!playerCode) return
    try {
      await navigator.clipboard.writeText(playerCode)
      toast.success('Player code copied', { description: 'Share it with your partner to team up.' })
    } catch {
      toast.error("Couldn't copy", { description: playerCode })
    }
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-6" aria-busy="true">
        <div className="flex items-center gap-4">
          <Skeleton className="size-24 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-10 w-1/2" />
          </div>
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </main>
    )
  }

  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || email
  const level = quizCompleted && score != null ? getLevel(score) : 'Unranked'
  const seasonDelta = (history ?? [])
    .filter(r => r.created_at.slice(0, 10) >= SEASON_START && !isQuiz(r.reason))
    .reduce((sum, r) => sum + (r.change ?? 0), 0)

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-10 pt-5 md:pt-10">
      {/* Identity */}
      <section className="flex items-center gap-4 md:gap-6">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingAvatar}
          className="group relative shrink-0 rounded-full focus-visible:outline-offset-4"
          aria-label="Change profile photo"
        >
          <Avatar src={avatarUrl} name={fullName} size="xl" className="md:size-28" />
          <span className="absolute bottom-0 right-0 flex size-9 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground transition-transform group-active:scale-95">
            {uploadingAvatar ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
          </span>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[34px] font-bold leading-none md:text-hero">{fullName}</h1>
          {playerCode && (
            <button
              type="button"
              onClick={copyCode}
              className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-[15px] tracking-wide text-muted-foreground hover:text-foreground"
              aria-label={`Copy player code ${playerCode}`}
            >
              {playerCode}
              <Copy className="size-4" aria-hidden />
            </button>
          )}
          <div className="mt-1.5">
            <SkillBadge level={level} variant="solid" size="md" />
          </div>
        </div>
      </section>
      {avatarMsg && <p className="mt-2 text-sm text-muted-foreground" role="status">{avatarMsg}</p>}

      <div className="mt-4 flex items-end gap-3">
        <p className="font-display text-rating font-bold tabular">{quizCompleted && score != null ? score : '—'}</p>
        {seasonDelta !== 0 && (
          <p className={cn('mb-1.5 font-display text-xl font-semibold', seasonDelta > 0 ? 'text-success' : 'text-destructive')}>
            {seasonDelta > 0 ? `+${seasonDelta}` : seasonDelta} <span className="text-base font-medium text-muted-foreground">this season</span>
          </p>
        )}
      </div>

      <Stagger className="mt-6 space-y-4">
        {/* Rating chart + stats */}
        <FadeUpItem>
          <Card className="p-4 md:p-5">
            {history === null ? <Skeleton className="h-64 w-full" /> : <RatingChart rows={history} />}
            <dl className={cn('mt-4 grid divide-x divide-border rounded-xl border border-border', teamStats ? 'grid-cols-3' : 'grid-cols-1')}>
              <Stat label="Tournaments" value={results ? String(results.length) : '—'} />
              {teamStats && <Stat label="Podiums" sub="team events" value={String(teamStats.podiums)} />}
              {teamStats && (
                <Stat label="Win rate" sub="team events" value={teamStats.played ? `${Math.round((teamStats.wins / teamStats.played) * 100)}%` : '—'} />
              )}
            </dl>
          </Card>
        </FadeUpItem>

        {/* Recent results */}
        <FadeUpItem>
          <Card className="p-4 md:p-5">
            <h2 className="mb-3 font-display text-2xl font-semibold">Recent results</h2>
            {results === null ? (
              <Skeleton className="h-20 w-full" />
            ) : results.length === 0 ? (
              <EmptyState icon={Trophy} title="No tournaments played yet" description="Your results show up here after your first event." />
            ) : (
              <ul className="space-y-2">
                {results.slice(0, 5).map(r => (
                  <li key={r.id}>
                    <Link
                      href={`/tournaments/${r.id}`}
                      className="flex min-h-[64px] items-center gap-3 rounded-xl border border-border bg-pitch-850 p-3 transition-colors active:bg-pitch-800"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-lg font-semibold leading-tight">{r.name}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {[r.format ?? 'Americano', r.location, formatEventDate(r.date, 'short')].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      {r.placement && (
                        <span
                          className={cn(
                            'shrink-0 text-right font-display text-lg font-semibold leading-tight',
                            r.placement.rank === 1 ? 'text-medal-gold' : r.placement.rank === 2 ? 'text-medal-silver' : r.placement.rank === 3 ? 'text-medal-bronze' : 'text-foreground'
                          )}
                        >
                          {r.placement.label}
                        </span>
                      )}
                      <ChevronRight className="size-5 shrink-0 text-subtle" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </FadeUpItem>

        {/* Skill levels + quiz */}
        <FadeUpItem>
          <Card className="p-4 md:p-5">
            <h2 className="mb-3 font-display text-2xl font-semibold">Player skill levels</h2>
            <div className="flex flex-wrap gap-2">
              {['Unranked', 'Beginner', 'Intermediate', 'Advanced'].map(l => (
                <SkillBadge key={l} level={l} variant="solid" size="md" dot className={cn(l !== level && 'opacity-55')} />
              ))}
            </div>
            {!quizCompleted && (
              <Link
                href="/quiz"
                className="mt-4 flex min-h-[64px] items-center gap-3 rounded-xl border border-border bg-pitch-850 p-3 transition-colors active:bg-pitch-800"
              >
                <ClipboardList className="size-6 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-semibold leading-tight">New to SmashTorino?</p>
                  <p className="text-sm text-muted-foreground">Take the {QUIZ_QUESTIONS.length}-question skill quiz</p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-subtle" aria-hidden />
              </Link>
            )}
          </Card>
        </FadeUpItem>

        {/* Account */}
        <FadeUpItem>
          <Card className="p-4 md:p-5">
            <h2 className="mb-4 font-display text-2xl font-semibold">Account</h2>
            <form onSubmit={saveProfile} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="First name" htmlFor="first-name">
                  <Input id="first-name" value={firstName} onChange={e => setFirstName(e.target.value)} autoComplete="given-name" />
                </Field>
                <Field label="Last name" htmlFor="last-name">
                  <Input id="last-name" value={lastName} onChange={e => setLastName(e.target.value)} autoComplete="family-name" />
                </Field>
              </div>
              <Field label="Email" htmlFor="email">
                <Input id="email" value={email} disabled readOnly />
              </Field>
              <Field label="Phone" htmlFor="phone" hint={phoneLoaded ? undefined : "Couldn't load your phone right now; it won't be changed."}>
                <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} disabled={!phoneLoaded} placeholder="+39 …" />
              </Field>
              <div className="flex items-center gap-3 pt-1">
                <Button type="submit" disabled={savingProfile}>
                  {savingProfile && <Loader2 className="animate-spin" />}
                  Save changes
                </Button>
                {profileMsg && <p className="text-sm text-muted-foreground" role="status">{profileMsg}</p>}
              </div>
            </form>

            <form onSubmit={changePassword} className="mt-6 space-y-3 border-t border-border pt-5">
              <Field label="New password" htmlFor="new-password">
                <Input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={6} />
              </Field>
              <div className="flex items-center gap-3">
                <Button type="submit" variant="secondary" disabled={savingPassword || !newPassword}>
                  {savingPassword && <Loader2 className="animate-spin" />}
                  Change password
                </Button>
                {passwordMsg && <p className="text-sm text-muted-foreground" role="status">{passwordMsg}</p>}
              </div>
            </form>
          </Card>
        </FadeUpItem>

        {/* Links (phones have no account menu) */}
        <FadeUpItem>
          <Card className="divide-y divide-border">
            {isAdmin && <LinkRow href="/admin" icon={Shield} label="Admin" accent />}
            <LinkRow href="/leaderboard" icon={Trophy} label="Leaderboard" />
            <LinkRow href="/about" icon={Info} label="About SmashTorino" />
            <button type="button" onClick={signOut} className="flex min-h-[56px] w-full items-center gap-3 px-4 text-left transition-colors hover:bg-white/5 active:bg-white/10">
              <LogOut className="size-5 text-muted-foreground" aria-hidden />
              <span className="flex-1">Sign out</span>
            </button>
          </Card>
        </FadeUpItem>
      </Stagger>
    </main>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="px-3 py-3 text-center">
      <dd className="font-display text-[28px] font-bold leading-none tabular">{value}</dd>
      <dt className="mt-1 text-sm text-muted-foreground">
        {label}
        {sub && <span className="block text-[11px] text-subtle">{sub}</span>}
      </dt>
    </div>
  )
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-muted-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-subtle">{hint}</p>}
    </div>
  )
}

function LinkRow({ href, icon: Icon, label, accent }: { href: string; icon: typeof Shield; label: string; accent?: boolean }) {
  return (
    <Link href={href} className="flex min-h-[56px] items-center gap-3 px-4 transition-colors hover:bg-white/5 active:bg-white/10">
      <Icon className={cn('size-5', accent ? 'text-primary-text' : 'text-muted-foreground')} aria-hidden />
      <span className={cn('flex-1', accent && 'text-primary-text')}>{label}</span>
      <ChevronRight className="size-5 text-subtle" aria-hidden />
    </Link>
  )
}
