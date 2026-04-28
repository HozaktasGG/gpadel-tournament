import Link from 'next/link'

export default function AboutPage() {
  return (
    <main
      className="flex-1 py-12 px-4 sm:px-6"
      style={{ backgroundColor: '#1a3d2e' }}
    >
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold text-white">About SmashTorino</h1>
        <p className="text-sm text-white/60 mt-2">
          Built by padel players, for padel players.
        </p>

        <div
          className="mt-8 rounded-2xl p-6 sm:p-8 space-y-5"
          style={{
            backgroundColor: '#0f2a1f',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <p className="text-sm sm:text-base text-white/80 leading-relaxed">
            SmashTorino is a grassroots padel community bringing together
            players of every level around Torino. Our focus is on three things:
          </p>

          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { icon: '🏆', title: 'Compete', body: 'Americano tournaments, real rankings, friendly rivalry.' },
              { icon: '📈', title: 'Improve', body: 'Track your skill score and climb from Beginner to Pro.' },
              { icon: '🤝', title: 'Connect', body: 'Find regular partners and meet new players every week.' },
            ].map(b => (
              <div
                key={b.title}
                className="rounded-xl p-4"
                style={{
                  backgroundColor: '#1a3d2e',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div className="text-2xl mb-2">{b.icon}</div>
                <p className="text-sm font-bold text-white">{b.title}</p>
                <p className="text-xs text-white/60 mt-1 leading-relaxed">{b.body}</p>
              </div>
            ))}
          </div>

          <p className="text-sm text-white/75 leading-relaxed">
            Whether you've picked up a racket for the first time or you're
            grinding for your first Pro badge — there's a spot on the court for
            you. Join a tournament, take the skill assessment, and introduce
            yourself to the community.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <Link
              href="/tournaments"
              className="flex-1 text-center px-6 py-3 rounded-full text-sm font-bold text-white transition hover:brightness-110"
              style={{ backgroundColor: '#ff6b35' }}
            >
              See Tournaments
            </Link>
            <Link
              href="/signup"
              className="flex-1 text-center px-6 py-3 rounded-full text-sm font-semibold text-white transition hover:bg-white/10"
              style={{
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              Create Account
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
