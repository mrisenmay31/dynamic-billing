export const metadata = {
  title: 'Privacy Policy · Clock to Bill',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white font-[var(--font-dm-sans)]">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <header className="mb-12">
          <p className="text-sm font-medium tracking-widest uppercase text-zinc-400 mb-2">Clock to Bill</p>
          <h1 className="text-4xl font-[var(--font-dm-serif)] text-zinc-900">Privacy Policy</h1>
          <p className="mt-3 text-sm text-zinc-500">Effective date: June 2026</p>
        </header>

        <div className="prose prose-zinc max-w-none leading-relaxed space-y-8 text-zinc-700">

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">1. About This Policy</h2>
            <p>
              This Privacy Policy describes how CTA Integrity, LLC (&ldquo;CTA Integrity,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;),
              headquartered in Salt Lake City, Utah, collects, uses, and protects information in connection with
              Clock to Bill — a private billing automation service (&ldquo;the Service&rdquo;). Clock to Bill is
              not publicly available; access is by invitation only and limited to authorized users of
              subscribing bookkeeping firms.
            </p>
            <p className="mt-3">
              By using the Service, you acknowledge that you have read and understood this Policy. Questions
              or requests may be directed to <a href="mailto:matt@ctaintegrity.com" className="text-blue-600 underline">matt@ctaintegrity.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">2. Information We Collect</h2>
            <p>We collect the following categories of information when you use the Service:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li><strong>Account information:</strong> your name and email address, provided at the time your account is created by an administrator.</li>
              <li><strong>QuickBooks OAuth tokens:</strong> access and refresh tokens issued by Intuit when you authorize the Service to connect to your QuickBooks Online and QuickBooks Time accounts. These tokens are stored encrypted at rest using AES-256-GCM.</li>
              <li><strong>Time entry data:</strong> billable time entries retrieved from QuickBooks Time via the authorized OAuth connection, including employee names, client (jobcode) identifiers, dates, and durations.</li>
              <li><strong>Invoice data:</strong> invoice drafts computed by the Service and invoices created in QuickBooks Online on your behalf, including client names, billing amounts, and invoice dates.</li>
              <li><strong>Usage logs:</strong> records of actions taken within the Service (e.g., billing runs initiated, invoices sent) for audit and troubleshooting purposes.</li>
            </ul>
            <p className="mt-3">
              We do not collect payment card information, Social Security numbers, or other sensitive personal
              identifiers beyond what is described above.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">3. How We Use Your Information</h2>
            <p>Information collected is used solely to operate the Service, which includes:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>Authenticating your account and maintaining your session.</li>
              <li>Connecting to QuickBooks Online and QuickBooks Time on your behalf to retrieve time entries and create invoices.</li>
              <li>Computing invoice drafts for your review and sending approved invoices via QuickBooks Online.</li>
              <li>Sending transactional emails (e.g., magic-link login emails) necessary to operate the Service.</li>
              <li>Maintaining audit logs of billing and invoice actions for your firm&rsquo;s records.</li>
              <li>Diagnosing and resolving technical issues.</li>
            </ul>
            <p className="mt-3">
              We do not use your data for advertising, profiling, or any purpose unrelated to operating the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">4. Third-Party Service Providers</h2>
            <p>
              We share data with the following third-party service providers only to the extent necessary to
              operate the Service. Each is bound by its own privacy and security commitments.
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li><strong>Intuit / QuickBooks:</strong> OAuth authorization and data exchange for QuickBooks Online and QuickBooks Time. Your data is subject to <a href="https://www.intuit.com/privacy/statement/" className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">Intuit&rsquo;s Privacy Statement</a>.</li>
              <li><strong>Supabase:</strong> cloud database and authentication infrastructure. Data is stored in the United States.</li>
              <li><strong>Vercel:</strong> application hosting and edge network. The Service runs on Vercel&rsquo;s infrastructure.</li>
              <li><strong>Resend:</strong> transactional email delivery (e.g., magic-link login emails).</li>
            </ul>
            <p className="mt-3">
              We do not sell, rent, or otherwise disclose your data to any other third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">5. Data Security</h2>
            <p>
              OAuth tokens are encrypted at rest using AES-256-GCM with a unique initialization vector per
              token. Access to the Service requires authentication. We implement reasonable technical and
              organizational measures to protect your data against unauthorized access, loss, or disclosure.
              No method of transmission or storage is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">6. Data Retention</h2>
            <p>
              We retain your data for as long as your firm maintains an active account with the Service.
              Time entries, invoice drafts, and audit logs are retained to support billing history and
              reconciliation. If you discontinue use of the Service, you may request deletion of your data
              by contacting <a href="mailto:matt@ctaintegrity.com" className="text-blue-600 underline">matt@ctaintegrity.com</a>.
              We will fulfill deletion requests within a reasonable time, subject to any legal obligations
              to retain records.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">7. Your Rights</h2>
            <p>
              You may contact us at <a href="mailto:matt@ctaintegrity.com" className="text-blue-600 underline">matt@ctaintegrity.com</a> to:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>Request access to the personal data we hold about you.</li>
              <li>Request correction of inaccurate data.</li>
              <li>Request deletion of your data.</li>
              <li>Revoke QuickBooks OAuth authorization (you may also revoke access directly within your Intuit account settings).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">8. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. If we make material changes, we will
              notify affected users by email or by posting a notice within the Service. Continued use of
              the Service after such notice constitutes acceptance of the updated Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">9. Governing Law</h2>
            <p>
              This Privacy Policy is governed by the laws of the State of Utah, without regard to its
              conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">10. Contact</h2>
            <p>
              CTA Integrity, LLC<br />
              Salt Lake City, Utah<br />
              <a href="mailto:matt@ctaintegrity.com" className="text-blue-600 underline">matt@ctaintegrity.com</a>
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
