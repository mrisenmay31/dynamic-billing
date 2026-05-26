Two files need to change. Do not touch anything else.

─── FILE 1: apps/web/scripts/get-magic-link.mjs ───

Change the redirectTo from /api/auth/callback back to /auth/callback:

  redirectTo: 'https://dynamic-billing.vercel.app/auth/callback',

─── FILE 2: src/app/auth/callback/page.tsx ───

Replace the entire file with this:

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

─── EXPLANATION FOR CLAUDE CODE ───

The root cause: Supabase is using implicit flow, sending #access_token= in the 
URL hash (not ?code= in the query string). Hashes are never sent to the server, 
so /api/auth/callback always sees no code and fails.

The original /auth/callback client component had a race condition: it called 
getSession() first, got null (hash not yet parsed), then registered 
onAuthStateChange — but by then the SIGNED_IN event had already fired and 
was missed. The 3-second fallback then fired and sent the user to /login.

The fix: register onAuthStateChange BEFORE calling getSession(), handle both 
SIGNED_IN and INITIAL_SESSION events, use a redirected flag to prevent 
double-fires, and give 5 seconds before the fallback.

After deploying: generate a fresh link with 
  node --env-file=.env.local scripts/get-magic-link.mjs
and confirm it lands on /invoices.