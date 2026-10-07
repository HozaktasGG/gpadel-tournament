'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AdminProfile } from './types'
import { fullName, searchKey } from './types'
import { Check, Search } from 'lucide-react'
import { Avatar, C, LevelBadge, PrimaryButton, Sheet, inputCls } from './ui'

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
      <div className="sticky top-0 z-10 bg-popover px-5 pb-3 pt-1">
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-subtle" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search name, email or player code"
            aria-label="Search players"
            className={`${inputCls} pl-12`}
            style={C.input}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
          />
        </div>
        <p className="mt-1.5 text-xs text-subtle">
          {results.length} of {profiles.length} players{multiple && selected.length > 0 ? ` · ${selected.length} selected` : ''}
        </p>
      </div>
      <ul className="space-y-1.5 px-3 pb-3">
        {results.map(p => {
          const reason = disabled?.get(p.id)
          const isSel = selected.includes(p.id)
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => toggle(p.id)}
                disabled={!!reason}
                aria-pressed={multiple ? isSel : undefined}
                className={`flex min-h-16 w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-45 ${isSel ? 'border-primary/40 bg-primary/10' : 'border-border bg-pitch-850 hover:bg-pitch-800'}`}
              >
                <Avatar profile={p} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-[17px] font-semibold leading-tight">{fullName(p)}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.player_code || 'no code'}</p>
                </div>
                <LevelBadge level={p.skill_level} />
                <span className="w-10 shrink-0 text-right font-display text-base font-semibold tabular">{p.skill_score || '–'}</span>
                {reason ? (
                  <span className="max-w-[30%] shrink-0 text-right text-xs font-semibold text-muted-foreground">{reason}</span>
                ) : multiple ? (
                  <span
                    aria-hidden
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full ${isSel ? 'bg-primary text-primary-foreground' : 'border-2 border-white/30'}`}
                  >
                    {isSel && <Check className="size-4" strokeWidth={3} />}
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
        {results.length === 0 && <li className="py-8 text-center text-sm text-muted-foreground">No players match “{query}”.</li>}
      </ul>
    </Sheet>
  )
}
