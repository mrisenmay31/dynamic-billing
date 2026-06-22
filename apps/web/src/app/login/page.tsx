"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuthFooter } from "@/components/AuthFooter";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    if (mode === "password") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        setError(error.message);
      } else {
        window.location.href = "/invoices";
      }
    } else {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      });
      setLoading(false);
      if (error) {
        setError(error.message);
      } else {
        setSubmitted(true);
      }
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">ClockToBill</h1>
          <p className="text-sm text-gray-500 mt-1">Automated billing for bookkeeping firms</p>
          <p className="text-xs text-gray-400 mt-0.5">A product of CTA Integrity, LLC</p>
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

            {mode === "password" && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <a href="/forgot-password" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                    Forgot password?
                  </a>
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2D6A4F] text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-[#235a42] disabled:opacity-50 transition-colors"
            >
              {loading ? "Signing in..." : mode === "password" ? "Sign in" : "Send login link"}
            </button>

            <button
              type="button"
              onClick={() => { setMode(mode === "password" ? "magic" : "password"); setError(null); }}
              className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              {mode === "password" ? "Sign in with a magic link instead" : "Use password instead"}
            </button>
          </form>
        )}
      </div>
      <AuthFooter />
    </div>
  );
}
