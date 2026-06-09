export const metadata = {
  title: 'Terms of Service · Clock to Bill',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white font-[var(--font-dm-sans)]">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <header className="mb-12">
          <p className="text-sm font-medium tracking-widest uppercase text-zinc-400 mb-2">Clock to Bill</p>
          <h1 className="text-4xl font-[var(--font-dm-serif)] text-zinc-900">Terms of Service</h1>
          <p className="mt-3 text-sm text-zinc-500">Effective date: June 2026</p>
        </header>

        <div className="prose prose-zinc max-w-none leading-relaxed space-y-8 text-zinc-700">

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">1. Acceptance of Terms</h2>
            <p>
              These Terms of Service (&ldquo;Terms&rdquo;) constitute a legally binding agreement between you and
              CTA Integrity, LLC (&ldquo;CTA Integrity,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;), headquartered in
              Salt Lake City, Utah. By accessing or using Clock to Bill (the &ldquo;Service&rdquo;), you agree to be
              bound by these Terms. If you do not agree, you must not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">2. Description of Service</h2>
            <p>
              Clock to Bill is a private billing automation tool that connects QuickBooks Time and
              QuickBooks Online to automate the generation and delivery of monthly invoices for bookkeeping
              firms. The Service retrieves approved time entries from QuickBooks Time, computes invoice
              drafts for firm owner review, and sends approved invoices via QuickBooks Online.
            </p>
            <p className="mt-3">
              The Service is private and not available to the general public. Access is limited to
              individuals who have been explicitly invited by CTA Integrity or an authorized firm
              administrator. There is no self-serve registration.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">3. Permitted Use</h2>
            <p>
              You may use the Service solely for your firm&rsquo;s internal billing operations, in accordance
              with these Terms and all applicable laws and regulations. Use of the Service is limited to
              authorized users of subscribing bookkeeping firms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">4. Prohibited Uses</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>Reverse engineer, decompile, disassemble, or otherwise attempt to derive the source code of the Service.</li>
              <li>Resell, sublicense, or otherwise make the Service available to any third party without prior written consent from CTA Integrity.</li>
              <li>Access the Service by means other than through the interfaces provided by CTA Integrity.</li>
              <li>Use the Service in any manner that could damage, disable, overburden, or impair it.</li>
              <li>Attempt to gain unauthorized access to any part of the Service or its underlying infrastructure.</li>
              <li>Use the Service for any unlawful purpose or in violation of any applicable law or regulation.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">5. Intellectual Property</h2>
            <p>
              The Service, including its software, design, and all related intellectual property, is and
              remains the exclusive property of CTA Integrity, LLC. These Terms do not grant you any
              ownership interest in the Service. All rights not expressly granted are reserved by
              CTA Integrity.
            </p>
            <p className="mt-3">
              Your firm&rsquo;s data (time entries, invoices, and related business records) remains your
              property. CTA Integrity uses it solely to operate the Service as described in the
              Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">6. Third-Party Integrations</h2>
            <p>
              The Service integrates with Intuit QuickBooks Online and QuickBooks Time via OAuth. Your use
              of those integrations is also subject to Intuit&rsquo;s terms of service and privacy policies.
              CTA Integrity is not responsible for the availability, accuracy, or conduct of any
              third-party service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">7. Disclaimer of Warranties</h2>
            <p>
              The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranty of any kind, express
              or implied, including but not limited to warranties of merchantability, fitness for a
              particular purpose, or uninterrupted availability. CTA Integrity does not warrant that the
              Service will be error-free or that any errors will be corrected.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">8. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by applicable law, CTA Integrity, LLC and its officers,
              employees, and agents shall not be liable for any indirect, incidental, special,
              consequential, or punitive damages, including but not limited to loss of profits, loss of
              data, or business interruption, arising out of or related to your use of or inability to
              use the Service, even if CTA Integrity has been advised of the possibility of such damages.
            </p>
            <p className="mt-3">
              In no event shall CTA Integrity&rsquo;s total liability to you for all claims arising out of or
              related to the Service exceed the amounts paid by your firm for the Service in the twelve
              months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">9. Changes to Terms</h2>
            <p>
              CTA Integrity may update these Terms at any time. We will provide notice of material changes
              by email or by posting a notice within the Service. Your continued use of the Service after
              such notice constitutes your acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">10. Termination</h2>
            <p>
              CTA Integrity reserves the right to suspend or terminate your access to the Service at any
              time, with or without cause, upon notice where practicable. Upon termination, your right to
              use the Service immediately ceases.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">11. Governing Law and Jurisdiction</h2>
            <p>
              These Terms are governed by the laws of the State of Utah, without regard to its conflict
              of law provisions. Any dispute arising out of or relating to these Terms or the Service
              shall be subject to the exclusive jurisdiction of the state and federal courts located in
              Utah.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">12. Contact</h2>
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
