"use client";

// Handles implicit-flow magic links (admin-generated or any redirect with
// #access_token in the hash). The Supabase browser client automatically
// detects and stores the session from the URL hash on initialization.
// The PKCE flow (login form → email → ?code=xxx) is handled server-side
// by /api/auth/callback/route.ts.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // Give the Supabase client a moment to parse the hash and store the session
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace("/invoices");
      } else {
        // Listen for the SIGNED_IN event in case parsing is still in progress
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === "SIGNED_IN" && session) {
            subscription.unsubscribe();
            router.replace("/invoices");
          }
        });
        // Fallback: if no session after 3s, back to login
        setTimeout(() => {
          subscription.unsubscribe();
          router.replace("/login");
        }, 3000);
      }
    };

    check();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-sm text-gray-500">Signing you in…</p>
    </div>
  );
}
