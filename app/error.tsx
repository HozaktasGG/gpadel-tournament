'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { RotateCcw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Route-level error boundary (keeps header / bottom nav). */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="size-8" aria-hidden />
      </span>
      <h1 className="mt-6 font-display text-[32px] font-bold leading-tight">Something went wrong</h1>
      <p className="mt-2 text-[17px] text-muted-foreground">Please try again. If it keeps happening, let us know on WhatsApp.</p>
      <div className="mt-6 flex w-full flex-col gap-3 sm:flex-row">
        <Button size="lg" className="sm:flex-1" onClick={reset}>
          <RotateCcw />
          Try again
        </Button>
        <Button asChild size="lg" variant="secondary" className="sm:flex-1">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </main>
  )
}
