import { notFound } from 'next/navigation'
import { UiKit } from './ui-kit'

// Dev-only component gallery for the redesign. 404 in production.
export default function UiKitPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <UiKit />
}
