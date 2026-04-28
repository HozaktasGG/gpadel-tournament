export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-white p-6 sm:p-12">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-black mb-8">Privacy Policy</h1>

        <div className="space-y-6 text-sm text-gray-700">
          <section>
            <p>
              SmashTorino Padel Community is committed to protecting your personal data.
              This policy explains what we collect, how we use it, and your rights.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-black mb-2">Data We Collect</h2>
            <p>We collect the following personal information during tournament registration:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>First name</li>
              <li>Last name</li>
              <li>Email address</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-black mb-2">How We Use Your Data</h2>
            <p>Your data is used solely for tournament registration and communication purposes. We do not use it for marketing or any other purpose.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-black mb-2">Third-Party Sharing</h2>
            <p>We do not share your personal data with any third parties.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-black mb-2">Data Retention</h2>
            <p>All personal data is deleted within 30 days after the tournament concludes.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-black mb-2">GDPR Compliance</h2>
            <p>
              We are based in Italy and fully comply with the General Data Protection Regulation (GDPR).
              You have the right to access, rectify, or erase your personal data at any time.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-black mb-2">Data Deletion Request</h2>
            <p>
              To request deletion of your data, please send an email to{' '}
              <a href="mailto:info@smashtorino.com" className="underline text-black">
                info@smashtorino.com
              </a>
              . We will process your request within 7 days.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-black mb-2">Contact</h2>
            <p>
              For any privacy-related questions, contact us at{' '}
              <a href="mailto:info@smashtorino.com" className="underline text-black">
                info@smashtorino.com
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-10">
          <a href="/" className="text-sm text-gray-500 underline">← Back to registration</a>
        </div>
      </div>
    </main>
  )
}
