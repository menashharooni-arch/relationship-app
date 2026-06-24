import LoginForm from "@/components/LoginForm";
import SwiftCardLogo from "@/components/SwiftCardLogo";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; mode?: string }>;
}) {
  const { next, mode } = await searchParams;
  const initialMode = mode === "signup" ? "signup" : "signin";
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
            {next ? "Sign in to accept your invitation." : initialMode === "signup" ? "Free forever. Ready in 60 seconds." : "Sign in or create your account."}
          </p>
        </div>
        <div className="bg-warm-card border border-warm-card-border rounded-2xl p-6 shadow-sm">
          <LoginForm redirectTo={next} initialMode={initialMode} />
        </div>
      </div>
    </main>
  );
}
