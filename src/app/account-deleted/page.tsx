import Link from "next/link";

export default function AccountDeletedPage() {
  return (
    <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center mb-6">
        <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={1.5} className="w-8 h-8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m6 2.25a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Your account has been deleted</h1>
      <p className="text-gray-400 text-sm mb-8 max-w-sm leading-relaxed">
        We&apos;re sorry to see you go. Your cards and contacts have been removed. For your security, this email can&apos;t be used to create a new account.
      </p>
      <Link href="/" className="text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors">
        Back to swiftcard.me
      </Link>
    </main>
  );
}
