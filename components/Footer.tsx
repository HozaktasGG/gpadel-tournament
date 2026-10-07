import Link from 'next/link'

const links = [
  { href: '/tournaments', label: 'Tournaments' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/about', label: 'About' },
  { href: '/privacy', label: 'Privacy Policy' },
]

function Social() {
  const cls =
    'flex size-11 items-center justify-center rounded-full border border-border-strong text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground'
  return (
    <div className="flex gap-3">
      <a href="https://www.instagram.com/smashtorino" target="_blank" rel="noopener noreferrer" className={cls} aria-label="Instagram">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <rect x="2" y="2" width="20" height="20" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
        </svg>
      </a>
      <a href="https://chat.whatsapp.com/LdiTKB1r7H2B73ohTq57NI" target="_blank" rel="noopener noreferrer" className={cls} aria-label="WhatsApp">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2a10 10 0 0 0-8.7 15l-1.3 5 5.1-1.3A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-3-.2-.3A8 8 0 1 1 12 20zm4.5-5.8c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.6.1-.2.3-.7.8-.8 1-.2.2-.3.2-.5.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.6-.1-.2 0-.4.1-.5l.4-.4c.1-.1.2-.3.3-.4.1-.2 0-.3 0-.4 0-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4H8.8c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.1 0 1.2.9 2.4 1 2.6.1.2 1.8 2.8 4.4 3.9 2.5 1 2.5.7 3 .6.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1-.1-.1-.3-.1-.5-.2z" />
        </svg>
      </a>
    </div>
  )
}

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="mt-auto border-t border-border bg-pitch-950">
      {/* Phones: compact (navigation lives in the bottom nav) */}
      <div className="flex flex-col items-center gap-3 px-4 py-6 text-center md:hidden">
        <Social />
        <Link href="/privacy" className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-4 hover:underline">
          Privacy Policy
        </Link>
        <p className="text-xs text-subtle">© {year} SmashTorino · Turin</p>
      </div>

      {/* Desktop */}
      <div className="mx-auto hidden max-w-[1200px] grid-cols-3 gap-8 px-8 py-10 md:grid">
        <div>
          <div className="mb-3 flex items-center gap-2.5">
            <img src="/smashpadel_logo.png" alt="" width={36} height={36} className="size-9 rounded-full" />
            <span className="font-display text-xl font-bold">SmashTorino</span>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">Torino’s padel community — compete, improve, connect.</p>
        </div>
        <nav aria-label="Footer">
          <p className="mb-3 text-overline font-semibold uppercase text-subtle">Explore</p>
          <ul className="space-y-2 text-[15px]">
            {links.map(l => (
              <li key={l.href}>
                <Link href={l.href} className="text-muted-foreground transition-colors hover:text-foreground">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <p className="mb-3 text-overline font-semibold uppercase text-subtle">Follow</p>
          <Social />
        </div>
      </div>
      <p className="hidden border-t border-border py-4 text-center text-xs text-subtle md:block">© {year} SmashTorino. Built for padel players in Torino.</p>
    </footer>
  )
}
