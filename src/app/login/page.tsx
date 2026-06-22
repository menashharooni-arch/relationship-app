import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-xs font-bold tracking-[0.25em] text-gray-500 uppercase mb-6">
            Evercard
          </p>
          <h1 className="text-2xl font-bold text-white">Sign in</h1>
          <p className="text-gray-400 text-sm mt-2">
            Enter your email and we&apos;ll send you a link.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
