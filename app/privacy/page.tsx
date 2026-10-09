export const metadata = { title: 'Privacy Policy · SmashTorino' }

export default function PrivacyPolicy() {
  return (
    <main className="flex-1 px-4 pb-12 pt-6 md:px-8 md:pt-10">
      <div className="max-w-2xl mx-auto">
        <h1 className="mb-6 font-display text-[36px] font-bold leading-none md:text-hero">Privacy Policy</h1>

        <div className="space-y-6 rounded-2xl border border-border bg-card p-5 text-[15px] leading-relaxed text-foreground/85 md:p-7">
          <section>
            <p>
              SmashTorino Padel Community is committed to protecting your personal data.
              This policy explains what we collect, how we use it, and your rights.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-xl font-semibold text-foreground">Data We Collect</h2>
            <p>We collect the following personal information during tournament registration:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>First name</li>
              <li>Last name</li>
              <li>Email address</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 font-display text-xl font-semibold text-foreground">How We Use Your Data</h2>
            <p>Your data is used solely for tournament registration and communication purposes. We do not use it for marketing or any other purpose.</p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-xl font-semibold text-foreground">Third-Party Sharing</h2>
            <p>We do not share your personal data with any third parties.</p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-xl font-semibold text-foreground">Data Retention</h2>
            <p>All personal data is deleted within 30 days after the tournament concludes.</p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-xl font-semibold text-foreground">GDPR Compliance</h2>
            <p>
              We are based in Italy and fully comply with the General Data Protection Regulation (GDPR).
              You have the right to access, rectify, or erase your personal data at any time.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-xl font-semibold text-foreground">Data Deletion Request</h2>
            <p>
              To request deletion of your data, please send an email to{' '}
              <a href="mailto:info@smashtorino.com" className="text-primary-text underline underline-offset-4">
                info@smashtorino.com
              </a>
              . We will process your request within 7 days.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-xl font-semibold text-foreground">Contact</h2>
            <p>
              For any privacy-related questions, contact us at{' '}
              <a href="mailto:info@smashtorino.com" className="text-primary-text underline underline-offset-4">
                info@smashtorino.com
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-10">
          <a href="/" className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">← Back to SmashTorino</a>
        </div>
      </div>
    </main>
  )
}
