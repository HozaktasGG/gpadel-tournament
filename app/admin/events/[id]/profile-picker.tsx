'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AdminProfile } from './types'
import { fullName, searchKey } from './types'
import { Avatar, C, PrimaryButton, Sheet } from './ui'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  profiles: AdminProfile[]
  multiple?: boolean
  // profile id → reason it can't be picked (e.g. "Registered", "In team X")
  disabled?: Map<string, string>
  confirmLabel?: (count: number) => string
  // Extra content above the confirm button (e.g. email checkbox, capacity warning)
  footerExtra?: (selected: string[]) => ReactNode
  onConfirm: (ids: string[]) => void
  busy?: boolean
}

export default function ProfilePicker({
  open,
  onClose,
  title,
  profiles,
  multiple,
  disabled,
  confirmLabel,
  footerExtra,
  onConfirm,
  busy,
}: Props) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected([])
    }
  }, [open])

  const indexed = useMemo(
    () =>
      profiles.map(p => ({
        p,
        key: searchKey([p.first_name, p.last_name, p.email, p.player_code, `${p.first_name ?? ''} ${p.last_name ?? ''}`].join(' ')),
      })),
    [profiles]
  )

  const results = useMemo(() => {
    const terms = searchKey(query).split(/\s+/).filter(Boolean)
    const list = terms.length === 0 ? indexed : indexed.filter(({ key }) => terms.every(t => key.includes(t)))
    return list.map(x => x.p)
  }, [indexed, query])

  const toggle = (id: string) => {
    if (disabled?.has(id)) return
    if (!multiple) {
      onConfirm([id])
      return
    }
    setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]))
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      tall
      footer={
        multiple ? (
          <div className="space-y-3">
            {footerExtra?.(selected)}
            <PrimaryButton className="w-full" disabled={selected.length === 0 || busy} onClick={() => onConfirm(selected)}>
              {busy ? 'Saving…' : confirmLabel ? confirmLabel(selected.length) : `Add ${selected.length || ''}`.trim()}
            </PrimaryButton>
          </div>
        ) : undefined
      }
    >
      <div className="sticky top-0 z-10 px-4 pb-3 pt-1" style={{ backgroundColor: C.card }}>
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search name, email or player code"
          className="w-full h-12 px-4 rounded-xl text-base text-white outline-none"
          style={C.input}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
        />
        <p className="text-[11px] text-white/40 mt-1.5">
          {results.length} of {profiles.length} players{multiple && selected.length > 0 ? ` · ${selected.length} selected` : ''}
        </p>
      </div>
      <ul className="px-2 pb-3">
        {results.map(p => {
          const reason = disabled?.get(p.id)
          const isSel = selected.includes(p.id)
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => toggle(p.id)}
                disabled={!!reason}
                className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-left min-h-14 disabled:opacity-45"
                style={isSel ? { backgroundColor: 'rgba(255,107,53,0.15)' } : undefined}
              >
                <Avatar profile={p} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white truncate">{fullName(p)}</p>
                  <p className="text-xs text-white/50 truncate">{p.email || 'no email'}</p>
                  <p className="text-[11px] font-mono text-white/40">{p.player_code || 'no code'}</p>
                </div>
                {reason ? (
                  <span className="text-[11px] font-semibold text-white/50 shrink-0 max-w-[40%] text-right">{reason}</span>
                ) : multiple ? (
                  <span
                    className="w-6 h-6 rounded-md shrink-0 flex items-center justify-center text-sm font-bold"
                    style={isSel ? { backgroundColor: C.orange, color: '#fff' } : { border: '2px solid rgba(255,255,255,0.3)' }}
                  >
                    {isSel ? '✓' : ''}
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
        {results.length === 0 && <li className="text-sm text-white/50 text-center py-8">No players match “{query}”.</li>}
      </ul>
    </Sheet>
  )
}
