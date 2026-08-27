import LoginForm from "@/components/LoginForm";
import SwiftCardLogo from "@/components/SwiftCardLogo";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; mode?: string; ref?: string }>;
}) {
  const { next, mode, ref } = await searchParams;

  // The app creates accounts too (owner decision 2026-08-27, IAP live): with
  // Pro purchasable in-app, the old sign-in-only posture — accounts deflected
  // to the website — is gone. Web and shell now render the same form.
  const initialMode = mode === "signup" ? "signup" : "signin";

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
                  : "Sign in or create your account."}
          </p>
        </div>
        <div className="bg-warm-card border border-warm-card-border rounded-2xl p-6 shadow-sm">
          <LoginForm redirectTo={next} initialMode={initialMode} />
        </div>
      </div>
    </main>
  );
}
