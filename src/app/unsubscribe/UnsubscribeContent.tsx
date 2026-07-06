"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function UnsubscribeContent() {
  const params = useSearchParams();
  const success = params.get("success") === "1";
  const error = params.get("error");

  if (success) {
    return (
      <div
        className="w-full max-w-md rounded-2xl p-8 text-center"
        style={{ background: "#fff", border: "1px solid #E4DDD4" }}
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ background: "#EDE5D8" }}
        >
          <span className="text-2xl">✓</span>
        </div>
        <h1 className="text-xl font-bold mb-2" style={{ color: "#0f172a" }}>
          You've been unsubscribed
        </h1>
        <p className="text-sm mb-6" style={{ color: "#64748b" }}>
          You won't receive any more marketing emails from SwiftCard.
          Transactional emails (receipts, security notices) are unaffected.
        </p>
        <Link
          href="/dashboard"
          className="inline-block text-sm font-semibold rounded-full px-6 py-3 transition-colors"
          style={{ background: "#1D4ED8", color: "#fff" }}
        >
          Go to dashboard
        </Link>
        <p className="mt-4 text-xs" style={{ color: "#94a3b8" }}>
          Changed your mind?{" "}
          <Link href="/settings/flows" className="underline">
            Update email preferences
          </Link>
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="w-full max-w-md rounded-2xl p-8 text-center"
        style={{ background: "#fff", border: "1px solid #E4DDD4" }}
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ background: "#FEE2E2" }}
        >
          <span className="text-2xl">!</span>
        </div>
        <h1 className="text-xl font-bold mb-2" style={{ color: "#0f172a" }}>
          Invalid unsubscribe link
        </h1>
        <p className="text-sm mb-6" style={{ color: "#64748b" }}>
          This link may have already been used or is no longer valid.
          You can manage your email preferences from your account settings.
        </p>
        <Link
          href="/settings/flows"
          className="inline-block text-sm font-semibold rounded-full px-6 py-3 transition-colors"
          style={{ background: "#1D4ED8", color: "#fff" }}
        >
          Manage preferences
        </Link>
      </div>
    );
  }

  // Landing state — token in URL but not yet triggered (shouldn't normally happen
  // since GET /api/unsubscribe redirects here, but covers direct navigation)
  return (
    <div
      className="w-full max-w-md rounded-2xl p-8 text-center"
      style={{ background: "#fff", border: "1px solid #E4DDD4" }}
    >
      <h1 className="text-xl font-bold mb-2" style={{ color: "#0f172a" }}>
        Unsubscribe from SwiftCard emails
      </h1>
      <p className="text-sm mb-6" style={{ color: "#64748b" }}>
        Manage your marketing email preferences from settings.
      </p>
      <Link
        href="/settings/flows"
        className="inline-block text-sm font-semibold rounded-full px-6 py-3"
        style={{ background: "#1D4ED8", color: "#fff" }}
      >
        Go to settings
      </Link>
    </div>
  );
}
