import Link from 'next/link'
import { MapPinOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-white/5 text-muted-foreground">
        <MapPinOff className="size-8" aria-hidden />
      </span>
      <p className="mt-6 font-display text-[64px] font-bold leading-none text-primary-text">404</p>
      <h1 className="mt-2 font-display text-[32px] font-bold leading-tight">Out of court</h1>
      <p className="mt-2 text-[17px] text-muted-foreground">This page doesn’t exist or has moved.</p>
      <div className="mt-6 flex w-full flex-col gap-3 sm:flex-row">
        <Button asChild size="lg" className="sm:flex-1">
          <Link href="/">Discover tournaments</Link>
        </Button>
        <Button asChild size="lg" variant="secondary" className="sm:flex-1">
          <Link href="/dashboard">My dashboard</Link>
        </Button>
      </div>
    </main>
  )
}
