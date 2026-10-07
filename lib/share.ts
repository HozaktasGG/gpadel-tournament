'use client'

import { toast } from 'sonner'

/**
 * Native share sheet (navigator.share) on iPhone; falls back to copying the
 * link with a toast. A user cancelling the share sheet is not an error.
 */
export async function shareLink({ title, text, url }: { title: string; text?: string; url: string }) {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url })
      return
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      // Fall through to copy on other failures (e.g. not allowed).
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    toast.success('Link copied', { description: 'Paste it anywhere to share this event.' })
  } catch {
    toast.error("Couldn't copy the link", { description: url })
  }
}
