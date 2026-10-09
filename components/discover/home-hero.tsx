import { MapPin } from 'lucide-react'

/** "Your next match starts here." — full-bleed on phones, rounded banner on desktop. */
export function HomeHero() {
  return (
    <section className="relative md:mx-auto md:mt-6 md:max-w-[1200px] md:px-8">
      <div className="relative overflow-hidden md:rounded-3xl md:border md:border-border">
        <img src="/hero-bg.jpg" alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/55 md:bg-gradient-to-r md:from-background md:via-background/80 md:to-background/10" />
        <div className="relative px-4 pb-6 pt-8 md:px-10 md:py-14">
          <p className="text-overline font-semibold uppercase text-foreground/85">Turin padel community</p>
          <h1 className="mt-2 max-w-xl text-balance font-display text-[38px] font-bold leading-[0.92] tracking-tight md:text-[64px]">
            Your next match starts here.
          </h1>
          <p className="mt-3 text-[17px] text-foreground/85 md:text-xl">Find your court. Meet your community.</p>
          <p className="mt-5 inline-flex h-10 items-center gap-2 rounded-full border border-border-strong bg-pitch-950/50 px-4 text-sm backdrop-blur-sm">
            <MapPin className="size-4 text-muted-foreground" aria-hidden />
            Turin, Italy
          </p>
        </div>
      </div>
    </section>
  )
}
