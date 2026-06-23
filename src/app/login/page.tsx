import LoginForm from "@/components/LoginForm";
import KontactLogo from "@/components/KontactLogo";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-8">
            <KontactLogo size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-gray-500 text-sm mt-2">
            Sign in or create your account.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
