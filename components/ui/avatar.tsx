'use client'

import * as React from 'react'
import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { cn } from '@/lib/utils'

export function initials(name: string | null | undefined) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0][0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : ''
  return (first + last).toUpperCase()
}

// Muted, on-brand fallback tones (white text passes AA on each).
const tones = ['bg-[#2d5a46]', 'bg-[#3a4f7a]', 'bg-[#5b4a85]', 'bg-[#7a4a3a]', 'bg-[#2f5f66]', 'bg-[#5f5a2f]']

function toneFor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return tones[h % tones.length]
}

const sizes = {
  xs: 'size-7 text-[11px]',
  sm: 'size-9 text-xs',
  md: 'size-11 text-sm',
  lg: 'size-14 text-base',
  xl: 'size-24 text-2xl',
  '2xl': 'size-28 text-3xl',
} as const

export type AvatarSize = keyof typeof sizes

/** Real avatar_url when present, otherwise initials. Never a stock face. */
export function Avatar({
  src,
  name,
  size = 'md',
  className,
  ring = false,
}: {
  src?: string | null
  name: string | null | undefined
  size?: AvatarSize
  className?: string
  ring?: boolean
}) {
  const label = name?.trim() || 'Player'
  return (
    <AvatarPrimitive.Root
      className={cn(
        'relative inline-flex shrink-0 overflow-hidden rounded-full',
        sizes[size],
        ring && 'ring-2 ring-pitch-850',
        className
      )}
    >
      {src ? <AvatarPrimitive.Image src={src} alt={label} className="size-full object-cover" /> : null}
      <AvatarPrimitive.Fallback
        delayMs={src ? 400 : 0}
        className={cn('flex size-full items-center justify-center font-display font-semibold text-white', toneFor(label))}
        aria-label={label}
      >
        {initials(label)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  )
}

/** Overlapping pair of avatars (team / court pairs). */
export function AvatarPair({
  a,
  b,
  size = 'sm',
  className,
}: {
  a: { src?: string | null; name: string | null | undefined }
  b: { src?: string | null; name: string | null | undefined }
  size?: AvatarSize
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center', className)}>
      <Avatar {...a} size={size} ring />
      <Avatar {...b} size={size} ring className="-ml-2.5" />
    </span>
  )
}
