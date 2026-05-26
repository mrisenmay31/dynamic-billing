"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/invoices`,
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setSubmitted(true);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Dynamic Billing</h1>
          <p className="text-sm text-gray-500 mt-1">P&L Business Services</p>
        </div>

        {submitted ? (
          <div className="text-center py-4">
            <p className="text-gray-700 font-medium">Check your email</p>
            <p className="text-sm text-gray-500 mt-2">
              We sent a login link to <span className="font-medium">{email}</span>.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2D6A4F] text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-[#235a42] disabled:opacity-50 transition-colors"
            >
              {loading ? "Sending..." : "Send login link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
