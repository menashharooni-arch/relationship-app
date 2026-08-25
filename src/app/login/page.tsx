import { cookies, headers } from "next/headers";
import LoginForm from "@/components/LoginForm";
import IapProbe from "@/components/IapProbe";
import SwiftCardLogo from "@/components/SwiftCardLogo";
import { isNativeRequest } from "@/lib/native-request";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; mode?: string; ref?: string }>;
}) {
  const { next, mode, ref } = await searchParams;

  // THE APP IS SIGN-IN ONLY. Accounts are created on the website; the shell
  // never offers it. Detected on the SERVER (user-agent token / sc_shell
  // cookie) rather than with useIsNativeApp(), because that hook is false on
  // the first render — so a client-side gate would paint "Create account" for
  // one frame and then remove it, which is precisely the glitch this is meant
  // to avoid. Here the app's first byte already has no signup in it.
  const [h, c] = await Promise.all([headers(), cookies()]);
  const native = isNativeRequest(h.get("user-agent"), c.get("sc_shell")?.value ?? null);

  // ?mode=signup is ignored in the app — a deep link, an old push, or a stale
  // referral URL must not be able to put the shell back into signup.
  const initialMode = !native && mode === "signup" ? "signup" : "signin";

  // Arrived through a referral link (/r/CODE → ?ref=1): show the "your first
  // month of Pro is free" copy. The reward itself is applied server-side at
  // /onboarding from the sc_ref cookie. (Signup is open to everyone — no code.)
  const isReferral = ref === "1";

  return (
    <main className="min-h-screen bg-cream flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <SwiftCardLogo size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            {initialMode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="text-slate-500 text-sm mt-2">
            {next
              ? "Sign in to accept your invitation."
              : isReferral && initialMode === "signup"
                ? "A friend invited you — your first month of Pro is free."
                : initialMode === "signup"
                  ? "Free to start. Ready in 30 seconds."
                  : native
                    ? // The web copy here reads "Sign in or create your
                      // account", which the app cannot honour.
                      "Sign in to continue."
                    : "Sign in or create your account."}
          </p>
        </div>
        <div className="bg-warm-card border border-warm-card-border rounded-2xl p-6 shadow-sm">
          <LoginForm redirectTo={next} initialMode={initialMode} signInOnly={native} />
          {/* TEMPORARY (remove after IAP verification): native-only, renders
              nothing — see components/IapProbe.tsx. The app is unreleased, so
              no real user can reach this; it exists so the StoreKit product
              fetch can be verified from the simulator without UI driving. */}
          <IapProbe />
        </div>
      </div>
    </main>
  );
}
