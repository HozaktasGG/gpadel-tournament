'use client'

import { useState } from 'react'

type Props = {
  playerCode: string
}

export default function PlayerCodeCard({ playerCode }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(playerCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API unavailable; ignore.
    }
  }

  return (
    <section
      className="mt-6 rounded-2xl p-6"
      style={{ backgroundColor: '#0f2318', border: '1px solid #2d5a40' }}
    >
      <p className="text-xs font-bold uppercase tracking-widest text-white/50">
        Oyuncu Kodun
      </p>

      <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
        <p
          className="font-mono font-bold text-2xl tracking-wider"
          style={{ color: '#ff6b35' }}
        >
          {playerCode}
        </p>
        <button
          type="button"
          onClick={handleCopy}
          className="px-4 py-2 rounded-full text-xs font-bold text-white transition"
          style={{ backgroundColor: copied ? '#22c55e' : '#2d5a40' }}
        >
          {copied ? '✓ Kopyalandı' : '📋 Kopyala'}
        </button>
      </div>

      <p className="text-xs text-white/60 mt-4 leading-relaxed">
        Partnerin sana bu kodu girerek takım kurabilir.
      </p>
    </section>
  )
}
