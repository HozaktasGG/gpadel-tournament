import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

/** Court-photo backdrop + card used by sign in / sign up / account setup. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <main className="relative flex flex-1 items-start justify-center overflow-hidden px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8 md:items-center md:py-16">
      <img src="/hero-bg.jpg" alt="" className="absolute inset-0 size-full object-cover opacity-50" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/90 to-background" />
      <div className="relative w-full max-w-md">
        <p className="text-overline font-semibold uppercase text-foreground/80">Turin padel community</p>
        <h1 className="mt-1 font-display text-[36px] font-bold leading-none md:text-hero">{title}</h1>
        {subtitle && <p className="mt-2 text-[17px] text-foreground/80">{subtitle}</p>}
        <div className="mt-6 rounded-2xl border border-border bg-card/95 p-5 shadow-elevated backdrop-blur-sm md:p-6">{children}</div>
        {footer && <div className="mt-5 text-center text-[15px] text-muted-foreground">{footer}</div>}
      </div>
    </main>
  )
}

export function GoogleButton({ onClick, disabled, label = 'Continue with Google' }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <Button type="button" variant="secondary" size="lg" block onClick={onClick} disabled={disabled} className="font-sans text-[15px] font-semibold">
      <svg viewBox="0 0 24 24" aria-hidden className="!size-5">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.34-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
      </svg>
      {label}
    </Button>
  )
}

export function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-[0.14em] text-subtle" role="separator">
      <span className="h-px flex-1 bg-border" />
      or
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

export function FormError({ children, className }: { children: React.ReactNode; className?: string }) {
  if (!children) return null
  return (
    <p role="alert" className={cn('rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive', className)}>
      {children}
    </p>
  )
}

export function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  )
}
