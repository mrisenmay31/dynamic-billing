"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let redirected = false;

    // Register listener FIRST before checking session.
    // Supabase parses the #access_token hash asynchronously on init —
    // if we call getSession() first we race against that parsing and lose.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (
          (event === "SIGNED_IN" || event === "INITIAL_SESSION") &&
          session &&
          !redirected
        ) {
          redirected = true;
          subscription.unsubscribe();
          router.replace("/invoices");
        }
      }
    );

    // Also check immediately in case parsing already completed
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !redirected) {
        redirected = true;
        subscription.unsubscribe();
        router.replace("/invoices");
      }
    });

    // Fallback: if nothing fires in 5s, give up and go to login
    const timeout = setTimeout(() => {
      if (!redirected) {
        subscription.unsubscribe();
        router.replace("/login");
      }
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-sm text-gray-500">Signing you in…</p>
    </div>
  );
}
