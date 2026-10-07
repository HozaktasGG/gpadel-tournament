import { cn } from '@/lib/utils'

/** Court photo thumbnail with the organizer logo (image_url) as a small badge — logos are never cropped. */
export function EventThumb({ imageUrl, className, badge = 'size-6' }: { imageUrl?: string | null; className?: string; badge?: string }) {
  return (
    <div className={cn('relative shrink-0 overflow-hidden rounded-xl bg-pitch-800', className)}>
      <img src="/hero-bg.jpg" alt="" loading="lazy" className="size-full object-cover" />
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          className={cn('absolute bottom-1.5 right-1.5 rounded-full border border-white/80 bg-white object-contain', badge)}
        />
      )}
    </div>
  )
}
