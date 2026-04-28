import Link from 'next/link'

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer
      className="mt-auto"
      style={{
        backgroundColor: '#0f2a1f',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 sm:grid-cols-3 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <img
              src="/smashpadel_logo.png"
              alt="SmashTorino"
              width={36}
              height={36}
              className="rounded-full"
            />
            <span className="font-bold text-white text-base">SmashTorino</span>
          </div>
          <p className="text-sm text-white/60 leading-relaxed">
            Torino's premier padel community — compete, improve, connect.
          </p>
        </div>

        <div>
          <p className="text-xs tracking-[0.2em] uppercase text-white/40 font-semibold mb-3">
            Explore
          </p>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/tournaments" className="text-white/75 hover:text-white transition">
                Tournaments
              </Link>
            </li>
            <li>
              <Link href="/leaderboard" className="text-white/75 hover:text-white transition">
                Leaderboard
              </Link>
            </li>
            <li>
              <Link href="/about" className="text-white/75 hover:text-white transition">
                About
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="text-white/75 hover:text-white transition">
                Privacy Policy
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-xs tracking-[0.2em] uppercase text-white/40 font-semibold mb-3">
            Follow
          </p>
          <div className="flex gap-3">
            <a
              href="https://www.instagram.com/smashtorino"
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white transition"
              style={{
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
              aria-label="Instagram"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
              </svg>
            </a>
            <a
              href="https://chat.whatsapp.com/LdiTKB1r7H2B73ohTq57NI"
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white transition"
              style={{
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
              aria-label="WhatsApp"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2a10 10 0 0 0-8.7 15l-1.3 5 5.1-1.3A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-3-.2-.3A8 8 0 1 1 12 20zm4.5-5.8c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.6.1-.2.3-.7.8-.8 1-.2.2-.3.2-.5.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.6-.1-.2 0-.4.1-.5l.4-.4c.1-.1.2-.3.3-.4.1-.2 0-.3 0-.4 0-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4H8.8c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.1 0 1.2.9 2.4 1 2.6.1.2 1.8 2.8 4.4 3.9 2.5 1 2.5.7 3 .6.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1-.1-.1-.3-.1-.5-.2z" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      <div
        className="border-t text-center py-4 text-xs text-white/40"
        style={{ borderColor: 'rgba(255,255,255,0.05)' }}
      >
        © {year} SmashTorino. Built for padel players in Torino.
      </div>
    </footer>
  )
}
