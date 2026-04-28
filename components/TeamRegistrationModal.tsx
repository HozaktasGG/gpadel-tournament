'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'

type Props = {
  eventId: string
  eventName: string
  onClose: () => void
  onSuccess: (partnerName: string) => void
}

type PartnerPreview = {
  id: string
  first_name: string | null
  last_name: string | null
  skill_level: string | null
  skill_score: number | null
  avatar_url: string | null
}

function levelColors(level: string | null): { bg: string; text: string } {
  switch (level) {
    case 'Advanced':     return { bg: 'rgba(234,179,8,0.2)',  text: '#eab308' }
    case 'Intermediate': return { bg: 'rgba(59,130,246,0.2)', text: '#3b82f6' }
    case 'Beginner':     return { bg: 'rgba(34,197,94,0.2)',  text: '#22c55e' }
    default:             return { bg: 'rgba(107,114,128,0.2)', text: '#9ca3af' }
  }
}

export default function TeamRegistrationModal({ eventId, eventName, onClose, onSuccess }: Props) {
  const supabase = createClient()
  const [step, setStep] = useState<1 | 2>(1)
  const [teamName, setTeamName] = useState('')
  const [partnerCode, setPartnerCode] = useState('')
  const [partner, setPartner] = useState<PartnerPreview | null>(null)
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const normalizeCode = (raw: string): string => {
    let v = raw.trim().toUpperCase().replace(/\s+/g, '')
    if (v && !v.startsWith('SMASH-')) {
      v = v.startsWith('SMASH') ? `SMASH-${v.slice(5)}` : `SMASH-${v}`
    }
    return v
  }

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.toUpperCase().slice(0, 12)
    setPartnerCode(v)
    setPartner(null)
    setError(null)
  }

  const handleSearch = async () => {
    setError(null)
    setPartner(null)
    const code = normalizeCode(partnerCode)
    if (!code || code.length < 7) {
      setError('Geçerli bir oyuncu kodu girin.')
      return
    }
    setSearching(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, skill_level, skill_score, avatar_url')
      .eq('player_code', code)
      .maybeSingle<PartnerPreview>()
    setSearching(false)
    if (!data) {
      setError('Oyuncu kodu bulunamadı.')
      return
    }
    setPartner(data)
    setPartnerCode(code)
  }

  const handleSubmit = async () => {
    setError(null)
    if (!teamName.trim()) {
      setError('Takım adı boş olamaz.')
      setStep(1)
      return
    }
    if (!partner) {
      setError('Önce partneri arayın.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/team-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          team_name: teamName.trim(),
          partner_code: normalizeCode(partnerCode),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Kayıt sırasında bir hata oluştu.')
        setSubmitting(false)
        return
      }
      const partnerName = data.partner_name ||
        [partner.first_name, partner.last_name].filter(Boolean).join(' ').trim() || 'Partner'
      onSuccess(partnerName)
    } catch {
      setError('Bağlantı hatası. Lütfen tekrar deneyin.')
      setSubmitting(false)
    }
  }

  const partnerLevel = partner?.skill_level ?? null
  const partnerColors = levelColors(partnerLevel)
  const partnerInitial = (partner?.first_name?.[0] ?? '?').toUpperCase()
  const partnerFullName = [partner?.first_name, partner?.last_name].filter(Boolean).join(' ').trim()

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 py-6"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ backgroundColor: '#1a3d2e', border: '1px solid #2d5a40' }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="h-1.5 w-full"
          style={{ background: '#0f2318' }}
        >
          <div
            className="h-full transition-all duration-300"
            style={{
              backgroundColor: '#ff6b35',
              width: step === 1 ? '50%' : '100%',
            }}
          />
        </div>

        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #2d5a40' }}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#ff6b35' }}>
              Adım {step} / 2
            </p>
            <h2 className="text-lg font-bold text-white mt-0.5">
              {step === 1 ? 'Takım Adı' : 'Partner Kodu'}
            </h2>
            <p className="text-xs text-white/60 mt-0.5 truncate">{eventName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/60 hover:text-white text-2xl leading-none px-2"
            aria-label="Kapat"
          >
            ×
          </button>
        </div>

        <div className="p-5">
          {step === 1 && (
            <>
              <label className="block text-xs font-semibold text-white/70 mb-2">
                Takımına bir isim ver
              </label>
              <input
                type="text"
                value={teamName}
                onChange={e => setTeamName(e.target.value.slice(0, 30))}
                maxLength={30}
                placeholder="Örn: Smash Bros"
                className="w-full px-4 py-3 rounded-lg text-sm text-white outline-none"
                style={{
                  backgroundColor: '#0f2318',
                  border: '1px solid #2d5a40',
                }}
                autoFocus
              />
              <div className="flex justify-between items-center mt-2">
                <p className="text-[11px] text-white/40">Takım adı (max 30 karakter)</p>
                <p className="text-[11px] text-white/50 font-mono">{teamName.length}/30</p>
              </div>

              {error && (
                <p className="text-xs text-red-300 mt-3">{error}</p>
              )}

              <button
                type="button"
                onClick={() => {
                  if (!teamName.trim()) {
                    setError('Takım adı boş olamaz.')
                    return
                  }
                  setError(null)
                  setStep(2)
                }}
                className="mt-5 w-full py-3 rounded-xl text-sm font-bold text-white"
                style={{ backgroundColor: '#ff6b35' }}
              >
                Devam →
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <label className="block text-xs font-semibold text-white/70 mb-2">
                Partnerinin oyuncu kodu
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={partnerCode}
                  onChange={handleCodeChange}
                  placeholder="SMASH-XXXX"
                  maxLength={10}
                  className="flex-1 px-4 py-3 rounded-lg text-sm text-white outline-none font-mono uppercase tracking-wider"
                  style={{
                    backgroundColor: '#0f2318',
                    border: '1px solid #2d5a40',
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSearch}
                  disabled={searching || !partnerCode}
                  className="px-4 rounded-lg text-sm font-bold text-white transition disabled:opacity-50"
                  style={{ backgroundColor: '#2d5a40' }}
                  aria-label="Ara"
                >
                  {searching ? '...' : '🔍'}
                </button>
              </div>
              <p className="text-[11px] text-white/40 mt-2">
                Partnerinin profil sayfasındaki kodu girin.
              </p>

              {partner && (
                <div
                  className="mt-4 rounded-xl p-4 flex items-center gap-3"
                  style={{ backgroundColor: '#0f2318', border: '1px solid #ff6b35' }}
                >
                  {partner.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={partner.avatar_url}
                      alt={partnerFullName}
                      width={48}
                      height={48}
                      className="rounded-full object-cover flex-shrink-0"
                      style={{ width: 48, height: 48 }}
                    />
                  ) : (
                    <span
                      className="flex items-center justify-center rounded-full text-base font-bold text-white flex-shrink-0"
                      style={{ width: 48, height: 48, backgroundColor: '#ff6b35' }}
                    >
                      {partnerInitial}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {partnerFullName || 'Oyuncu'}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {partnerLevel && (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ background: partnerColors.bg, color: partnerColors.text }}
                        >
                          {partnerLevel}
                        </span>
                      )}
                      {partner.skill_score != null && (
                        <span className="text-[11px] text-white/60">
                          {partner.skill_score} pts
                        </span>
                      )}
                    </div>
                  </div>
                  <span style={{ color: '#22c55e' }} className="text-xl flex-shrink-0">✓</span>
                </div>
              )}

              {error && (
                <p className="text-xs text-red-300 mt-3">{error}</p>
              )}

              <p className="text-[11px] text-white/50 mt-4 text-center">
                Partnerinize onay emaili gönderilecektir.
              </p>

              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => { setError(null); setStep(1) }}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-white"
                  style={{ backgroundColor: 'transparent', border: '1px solid #2d5a40' }}
                >
                  ← Geri
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || !partner}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                  style={{ backgroundColor: '#ff6b35' }}
                >
                  {submitting ? 'Kaydediliyor...' : 'Kayıt Ol 🎾'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
