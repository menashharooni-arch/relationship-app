import LoginForm from "@/components/LoginForm";
import SwiftCardLogo from "@/components/SwiftCardLogo";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; mode?: string; ref?: string }>;
}) {
  const { next, mode, ref } = await searchParams;
  const initialMode = mode === "signup" ? "signup" : "signin";
  // Arrived through a referral link (/r/CODE): the referral is their invite, so
  // the signup form must not demand an invite code. The authoritative check is
  // still server-side at /onboarding (sc_ref cookie → real referrer).
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
          <LoginForm redirectTo={next} initialMode={initialMode} isReferral={isReferral} />
        </div>
      </div>
    </main>
  );
}
