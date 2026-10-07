import * as React from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

// text-base = 16px: prevents iOS Safari from zooming on focus.
const inputClass =
  'flex h-12 w-full rounded-xl border border-input bg-pitch-800 px-4 text-base text-foreground placeholder:text-subtle ' +
  'transition-colors focus-visible:border-primary-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input ref={ref} type={type} className={cn(inputClass, className)} {...props} />
  )
)
Input.displayName = 'Input'

const SearchInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <div className={cn('relative', className)}>
      <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-subtle" />
      <input ref={ref} type="search" enterKeyHint="search" className={cn(inputClass, 'pl-12')} {...props} />
    </div>
  )
)
SearchInput.displayName = 'SearchInput'

export { Input, SearchInput, inputClass }
