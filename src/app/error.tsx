"use client";

import { useEffect } from "react";

// App-wide error boundary — without this, an uncaught error anywhere renders
// Next.js's default unstyled error screen instead of anything on-brand.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app error boundary]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-5">
      <div className="text-center max-w-sm">
        <h1 className="text-2xl font-bold text-white mb-3">Something went wrong</h1>
        <p className="text-gray-500 text-sm mb-6">
          We hit an unexpected error. Try again, or refresh the page.
        </p>
        <button
          onClick={() => reset()}
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm px-5 py-2.5 rounded-full transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
