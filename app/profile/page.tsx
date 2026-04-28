'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { getLevel, getLevelColor } from '@/lib/quiz-questions'
import ScoreHistory from './score-history'

export default function ProfilePage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [score, setScore] = useState<number | null>(null)
  const [quizCompleted, setQuizCompleted] = useState(false)
  const [phone, setPhone] = useState('')
  const [playerCode, setPlayerCode] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)

  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarMsg, setAvatarMsg] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')

  const [newPassword, setNewPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState('')

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
        .select('first_name, last_name, avatar_url, skill_score, quiz_completed_at, phone, player_code')
        .eq('id', user.id)
        .maybeSingle()
      if (data) {
        setFirstName(data.first_name ?? '')
        setLastName(data.last_name ?? '')
        setAvatarUrl(data.avatar_url ?? null)
        setScore(data.skill_score ?? null)
        setQuizCompleted(!!data.quiz_completed_at)
        setPhone(data.phone ?? '')
        setPlayerCode(data.player_code ?? null)
      }
      setLoading(false)
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

    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: firstName,
        last_name: lastName,
        phone: phone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    setSavingProfile(false)
    setProfileMsg(error ? error.message : 'Saved ✓')
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

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#1a3d2e' }}>
        <p className="text-sm text-white/70">Loading...</p>
      </main>
    )
  }

  const level = quizCompleted && score != null ? getLevel(score) : null
  const levelColor = level ? getLevelColor(level) : null

  return (
    <main
      className="flex-1 py-10 px-4 sm:px-6"
      style={{ backgroundColor: '#1a3d2e' }}
    >
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white">Profile</h1>
        <p className="text-sm text-white/60 mt-1">Manage your account details.</p>

        {/* Avatar */}
        <section
          className="mt-6 rounded-2xl p-6 flex items-center gap-5"
          style={{
            backgroundColor: '#0f2a1f',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="relative flex-shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                width={72}
                height={72}
                className="rounded-full object-cover"
                style={{ width: 72, height: 72 }}
              />
            ) : (
              <span
                className="flex items-center justify-center rounded-full text-2xl font-bold text-white"
                style={{ width: 72, height: 72, backgroundColor: '#ff6b35' }}
              >
                {(firstName?.[0] ?? email?.[0] ?? '?').toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-white truncate">
              {[firstName, lastName].filter(Boolean).join(' ') || email || 'Profile'}
            </p>
            {playerCode && (
              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                <span className="text-[#ff6b35] font-mono font-bold text-sm tracking-widest">
                  {playerCode}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(playerCode)
                      setCopiedCode(true)
                      setTimeout(() => setCopiedCode(false), 2000)
                    } catch {
                      // Clipboard API unavailable
                    }
                  }}
                  className="bg-[#1a3d2e] hover:bg-[#2d5a40] text-gray-300 hover:text-white px-2.5 py-1 rounded-md text-[11px] font-medium transition"
                >
                  {copiedCode ? '✓ Kopyalandı' : '📋 Kopyala'}
                </button>
              </div>
            )}
            {avatarMsg && (
              <p
                className={`text-xs mt-2 ${avatarMsg.includes('✓') ? 'text-green-300' : 'text-red-300'}`}
              >
                {avatarMsg}
              </p>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="mt-3 px-4 py-2 rounded-full text-xs font-bold text-white transition disabled:opacity-50"
              style={{ backgroundColor: '#ff6b35' }}
            >
              {uploadingAvatar
                ? 'Uploading...'
                : avatarUrl
                  ? 'Change photo'
                  : 'Upload photo'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
        </section>

        {/* Quiz card */}
        <div
          className="mt-6 rounded-2xl p-5 flex items-center gap-4"
          style={{
            backgroundColor: '#0f2a1f',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="flex-1">
            <p className="text-xs text-white/50 font-semibold tracking-wide uppercase">
              Skill Assessment
            </p>
            {quizCompleted && level && levelColor ? (
              <div className="mt-1.5 flex items-baseline gap-3">
                <p className="text-2xl font-bold text-white leading-none">
                  {score}
                  <span className="text-xs text-white/40 font-semibold ml-1">pts</span>
                </p>
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: levelColor.bg, color: levelColor.text }}
                >
                  {levelColor.icon && <span>{levelColor.icon}</span>}
                  <span>{level}</span>
                </span>
              </div>
            ) : (
              <p className="text-sm text-white/75 mt-1">
                You haven't taken the quiz yet.
              </p>
            )}
          </div>
        </div>

        {/* Score history */}
        {userId && <ScoreHistory userId={userId} />}

        {/* Edit profile */}
        <section
          className="mt-6 rounded-2xl p-6"
          style={{
            backgroundColor: '#0f2a1f',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <h2 className="text-lg font-bold text-white mb-4">
            Personal information
          </h2>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1.5">
                  First name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg text-sm text-white outline-none"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1.5">
                  Last name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg text-sm text-white outline-none"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full px-3.5 py-2.5 rounded-lg text-sm text-white/60 outline-none"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              />
              <p className="text-[11px] text-white/40 mt-1">
                Email can't be changed here.
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+39 123 456 7890"
                className="w-full px-3.5 py-2.5 rounded-lg text-sm text-white outline-none"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              />
            </div>
            {profileMsg && (
              <p className={`text-xs ${profileMsg.includes('✓') ? 'text-green-300' : 'text-red-300'}`}>
                {profileMsg}
              </p>
            )}
            <button
              type="submit"
              disabled={savingProfile}
              className="w-full py-3 rounded-xl text-sm font-bold text-white transition disabled:opacity-50"
              style={{ backgroundColor: '#ff6b35' }}
            >
              {savingProfile ? 'Saving...' : 'Save changes'}
            </button>
          </form>
        </section>

        {/* Change password */}
        <section
          className="mt-6 rounded-2xl p-6"
          style={{
            backgroundColor: '#0f2a1f',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <h2 className="text-lg font-bold text-white mb-4">Change password</h2>
          <form onSubmit={changePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">
                New password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                minLength={6}
                placeholder="At least 6 characters"
                className="w-full px-3.5 py-2.5 rounded-lg text-sm text-white outline-none"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              />
            </div>
            {passwordMsg && (
              <p className={`text-xs ${passwordMsg.includes('✓') ? 'text-green-300' : 'text-red-300'}`}>
                {passwordMsg}
              </p>
            )}
            <button
              type="submit"
              disabled={savingPassword || !newPassword}
              className="w-full py-3 rounded-xl text-sm font-bold text-white transition disabled:opacity-50"
              style={{
                backgroundColor: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              {savingPassword ? 'Updating...' : 'Update password'}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
