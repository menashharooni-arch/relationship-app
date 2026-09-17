"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Shown for the few seconds between Stripe sending the buyer back and Stripe's
// webhook actually giving them the plan. Re-asks the server every two seconds;
// the page redirects on its own the moment the plan is there.
export default function AwaitingPlan({ planName }: { planName: string }) {
  const router = useRouter();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const tick = setInterval(() => router.refresh(), 2000);
    const late = setTimeout(() => setSlow(true), 45000);
    return () => { clearInterval(tick); clearTimeout(late); };
  }, [router]);

  return (
    <main className="sc-app min-h-screen bg-gray-950 flex items-center justify-center px-5">
      <div className="max-w-sm text-center">
        <div className="h-9 w-9 mx-auto mb-5 animate-spin rounded-full border-2 border-gray-700 border-t-blue-500" />
        <h1 className="text-white font-bold text-xl">Setting up your {planName} plan…</h1>
        <p className="text-gray-400 text-sm mt-2 leading-relaxed">
          Your payment went through. This usually takes a few seconds — please keep this page open.
        </p>
        {slow && (
          <p className="text-gray-500 text-xs mt-5 leading-relaxed">
            Still confirming with our payment provider. You can safely{" "}
            <button type="button" onClick={() => window.location.reload()} className="text-blue-400 underline">refresh</button>
            {" "}— you won&apos;t be charged twice.
          </p>
        )}
      </div>
    </main>
  );
}
