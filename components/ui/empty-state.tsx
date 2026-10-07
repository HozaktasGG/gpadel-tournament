import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center rounded-2xl border border-dashed border-border-strong px-6 py-10 text-center', className)}>
      {Icon && (
        <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-white/5 text-muted-foreground">
          <Icon className="size-6" aria-hidden />
        </span>
      )}
      <p className="font-display text-xl font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
