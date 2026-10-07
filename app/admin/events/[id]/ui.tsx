'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { getLevelColor } from '@/lib/quiz-questions'
import { useScrollLock } from '@/lib/use-scroll-lock'
import type { AdminProfile } from './types'
import { fullName } from './types'

export const C = {
  bg: '#1a3d2e',
  card: '#0f2a1f',
  orange: '#ff6b35',
  border: 'rgba(255,255,255,0.08)',
  input: { backgroundColor: '#1a3d2e', border: '1px solid rgba(255,255,255,0.12)' },
}

export const inputCls = 'w-full px-3 py-3 rounded-xl text-base text-white outline-none'
export const labelCls = 'block text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5'

// ───────── Bottom sheet (full-width on phones, centered card on larger screens) ─────────

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  tall,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  tall?: boolean
}) {
  useScrollLock(open)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div
        className={`w-full sm:max-w-lg flex flex-col rounded-t-2xl sm:rounded-2xl ${tall ? 'h-[92dvh] sm:h-[80vh]' : 'max-h-[92dvh] sm:max-h-[85vh]'}`}
        style={{ backgroundColor: C.card, border: '1px solid rgba(255,255,255,0.12)' }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2 shrink-0">
          <h3 className="text-base font-bold text-white truncate">{title}</h3>
          <button onClick={onClose} className="w-11 h-11 -mr-2 flex items-center justify-center text-white/60 text-2xl" aria-label="Close">
            ×
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">{children}</div>
        {footer && (
          <div className="shrink-0 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]" style={{ borderTop: `1px solid ${C.border}` }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// ───────── Confirm dialog (promise based) ─────────

type ConfirmOptions = {
  title: string
  message?: ReactNode
  confirmLabel?: string
  destructive?: boolean
  checkbox?: string
}

type ConfirmState = ConfirmOptions & { resolve: (v: { ok: boolean; checked: boolean }) => void }

export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null)
  const [checked, setChecked] = useState(false)
  useScrollLock(!!state)

  const ask = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<{ ok: boolean; checked: boolean }>(resolve => {
        setChecked(false)
        setState({ ...opts, resolve })
      }),
    []
  )

  const close = (ok: boolean) => {
    state?.resolve({ ok, checked })
    setState(null)
  }

  const dialog = state ? (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ backgroundColor: 'rgba(0,0,0,0.75)' }} onClick={() => close(false)}>
      <div
        className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        style={{ backgroundColor: C.card, border: '1px solid rgba(255,255,255,0.12)' }}
        onClick={e => e.stopPropagation()}
        role="alertdialog"
      >
        <h3 className="text-base font-bold text-white mb-2">{state.title}</h3>
        {state.message && <div className="text-sm text-white/70 mb-4 space-y-2">{state.message}</div>}
        {state.checkbox && (
          <label className="flex items-start gap-3 mb-4 text-sm text-white/80 min-h-11 cursor-pointer">
            <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} className="mt-0.5 w-5 h-5 accent-[#ff6b35]" />
            <span>{state.checkbox}</span>
          </label>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => close(false)} className="h-12 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
            Cancel
          </button>
          <button
            onClick={() => close(true)}
            className="h-12 rounded-xl text-sm font-bold text-white"
            style={{ backgroundColor: state.destructive ? '#dc2626' : C.orange }}
          >
            {state.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  ) : null

  return { ask, dialog }
}

// ───────── Toasts ─────────

type Toast = { id: number; type: 'success' | 'error'; text: string }

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const push = useCallback((type: Toast['type'], text: string) => {
    const id = nextId.current++
    setToasts(t => [...t, { id, type, text }])
    window.setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), type === 'error' ? 6000 : 3000)
  }, [])

  const view = (
    <div className="fixed left-0 right-0 top-0 z-[70] flex flex-col items-center gap-2 p-3 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className="pointer-events-auto max-w-md w-full px-4 py-3 rounded-xl text-sm font-semibold shadow-lg"
          style={
            t.type === 'success'
              ? { backgroundColor: '#14532d', color: '#bbf7d0', border: '1px solid rgba(34,197,94,0.5)' }
              : { backgroundColor: '#7f1d1d', color: '#fecaca', border: '1px solid rgba(239,68,68,0.5)' }
          }
          role="status"
          onClick={() => setToasts(ts => ts.filter(x => x.id !== t.id))}
        >
          {t.type === 'success' ? '✓ ' : '⚠ '}
          {t.text}
        </div>
      ))}
    </div>
  )

  return { push, view }
}

// ───────── Small bits ─────────

export function Avatar({ profile, size = 40 }: { profile: AdminProfile | null | undefined; size?: number }) {
  const initials = (fullName(profile).split(/\s+/).map(s => s[0]).join('').slice(0, 2) || '?').toUpperCase()
  if (profile?.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={profile.avatar_url} alt="" width={size} height={size} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
  }
  return (
    <div
      className="rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white"
      style={{ width: size, height: size, backgroundColor: 'rgba(255,107,53,0.25)', border: '1px solid rgba(255,107,53,0.4)' }}
    >
      {initials}
    </div>
  )
}

export function LevelBadge({ level }: { level: string | null }) {
  if (!level) return null
  const c = getLevelColor(level)
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap" style={{ background: c.bg, color: c.text }}>
      {c.icon && <span>{c.icon}</span>}
      {level}
    </span>
  )
}

export function Section({ title, count, action, children }: { title: string; count?: number; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl p-4 sm:p-6 mb-4" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-bold text-white">
          {title}
          {count !== undefined && <span className="ml-2 text-sm font-normal text-white/50">({count})</span>}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = '', style, ...rest } = props
  return <button {...rest} className={`h-12 px-4 rounded-xl text-sm font-bold text-white disabled:opacity-50 ${className}`} style={{ backgroundColor: C.orange, ...style }} />
}

export function GhostButton(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  const { className = '', danger, style, ...rest } = props
  return (
    <button
      {...rest}
      className={`min-h-11 px-3 rounded-xl text-sm font-semibold disabled:opacity-50 ${className}`}
      style={
        danger
          ? { backgroundColor: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', ...style }
          : { backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', ...style }
      }
    />
  )
}
