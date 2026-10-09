'use client'

// Admin UI primitives. Same exported API as before, now built on the shared
// design-system components (bottom sheet, dialog, sonner toasts, avatar, badges).

import { useCallback, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { BottomSheet } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar as UiAvatar, type AvatarSize } from '@/components/ui/avatar'
import { SkillBadge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { AdminProfile } from './types'
import { fullName } from './types'

export const C = {
  bg: 'rgb(10 31 25)',
  card: 'rgb(18 48 42)', // sheet surface (popover)
  orange: 'rgb(255 138 92)', // orange used as text on dark surfaces (AA)
  border: 'rgb(255 255 255 / 0.08)',
  input: { backgroundColor: 'rgb(18 48 42)', border: '1px solid rgb(255 255 255 / 0.14)' },
}

// 16px text (no iOS zoom), 48px tall.
export const inputCls =
  'w-full min-h-12 px-4 py-3 rounded-xl text-base text-foreground placeholder:text-subtle outline-none transition-colors focus-visible:border-primary-text focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50'
export const labelCls = 'block text-sm font-medium text-muted-foreground mb-1.5'

// ───────── Bottom sheet (phones) / centered panel (desktop) ─────────

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
  return (
    <BottomSheet
      open={open}
      onOpenChange={o => !o && onClose()}
      title={title}
      footer={footer}
      bodyClassName="px-0"
      className={tall ? 'h-[92dvh] md:h-[80dvh]' : undefined}
    >
      {children}
    </BottomSheet>
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

  const dialog = (
    <Dialog open={!!state} onOpenChange={o => !o && close(false)}>
      <DialogContent role="alertdialog">
        {state && (
          <>
            <DialogHeader>
              <DialogTitle>{state.title}</DialogTitle>
              {state.message ? (
                <DialogDescription asChild>
                  <div className="space-y-2">{state.message}</div>
                </DialogDescription>
              ) : (
                <DialogDescription className="sr-only">{state.title}</DialogDescription>
              )}
            </DialogHeader>
            {state.checkbox && (
              <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
                <Checkbox checked={checked} onCheckedChange={v => setChecked(v === true)} className="mt-0.5" />
                <span>{state.checkbox}</span>
              </label>
            )}
            <DialogFooter className="grid grid-cols-2 gap-2 sm:flex">
              <Button variant="secondary" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => close(true)}
                className={state.destructive ? 'bg-destructive text-skill-ink shadow-none hover:bg-destructive/90 active:bg-destructive/80' : undefined}
              >
                {state.confirmLabel ?? 'Confirm'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )

  return { ask, dialog }
}

// ───────── Toasts (app-wide sonner) ─────────

export function useToasts() {
  const push = useCallback((type: 'success' | 'error', text: string) => {
    if (type === 'success') toast.success(text)
    else toast.error(text, { duration: 6000 })
  }, [])
  return { push, view: null as ReactNode }
}

// ───────── Small bits ─────────

const avatarSize = (px: number): AvatarSize => (px <= 28 ? 'xs' : px <= 36 ? 'sm' : px <= 44 ? 'md' : 'lg')

export function Avatar({ profile, size = 40 }: { profile: AdminProfile | null | undefined; size?: number }) {
  return <UiAvatar src={profile?.avatar_url} name={fullName(profile)} size={avatarSize(size)} />
}

export function LevelBadge({ level }: { level: string | null }) {
  if (!level) return null
  return <SkillBadge level={level} />
}

export function Section({ title, count, action, children }: { title: string; count?: number; action?: ReactNode; children: ReactNode }) {
  return (
    <Card className="mb-4 p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-[22px] font-semibold">
          {title}
          {count !== undefined && <span className="ml-2 font-sans text-sm font-normal text-muted-foreground">({count})</span>}
        </h2>
        {action}
      </div>
      {children}
    </Card>
  )
}

export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className, style, ...rest } = props
  return <Button {...rest} style={style} className={cn('h-12', className)} />
}

export function GhostButton(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  const { className, danger, style, ...rest } = props
  return (
    <Button
      {...rest}
      style={style}
      variant="secondary"
      size="sm"
      className={cn('min-h-11 font-sans text-sm font-semibold', danger && 'border-destructive/40 text-destructive hover:bg-destructive/10', className)}
    />
  )
}
