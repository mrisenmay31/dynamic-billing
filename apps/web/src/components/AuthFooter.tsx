// Shared footer for the unauthenticated auth pages (login, forgot/reset password).
// Surfaces real company identity and links to established, verifiable resources so
// these otherwise-bare credential pages don't read as anonymous phishing pages to
// users or to automated classifiers (e.g. Google Safe Browsing).
export function AuthFooter() {
  return (
    <footer className="w-full max-w-sm mt-6 text-center">
      <nav className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-gray-400">
        <a
          href="https://clocktobill.com"
          className="hover:text-gray-600 transition-colors"
        >
          clocktobill.com
        </a>
        <span aria-hidden="true">·</span>
        <a href="/privacy" className="hover:text-gray-600 transition-colors">
          Privacy
        </a>
        <span aria-hidden="true">·</span>
        <a href="/terms" className="hover:text-gray-600 transition-colors">
          Terms
        </a>
        <span aria-hidden="true">·</span>
        <a
          href="mailto:support@ctaintegrity.com"
          className="hover:text-gray-600 transition-colors"
        >
          Support
        </a>
      </nav>
      <p className="mt-2 text-xs text-gray-400">
        © 2026 Clock to Bill — a product of CTA Integrity, LLC
      </p>
    </footer>
  );
}
