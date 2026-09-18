"use client";

import { useState } from "react";

// "Copy personal link" on a contact. Copies the owner's card URL carrying this
// contact's own token (POST /api/leads/[id]/link, lib/contact-links.ts), for a
// message the owner sends from their own apps. When the contact opens it, the
// browser they open it in is recognised as theirs from then on.
//
// SAFARI: a clipboard write must happen inside the tap's user activation, and
// an awaited fetch spends it. ClipboardItem accepts a PROMISE of the content,
// which keeps the write inside the gesture while the link is minted. Browsers
// without it fall back to fetch-then-writeText, which works everywhere else.
export default function CopyPersonalLinkButton({ leadId, firstName }: { leadId: string; firstName: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  const mint = async (): Promise<string> => {
    const res = await fetch(`/api/leads/${leadId}/link`, { method: "POST" });
    if (!res.ok) throw new Error(String(res.status));
    const { url } = (await res.json()) as { url?: string };
    if (!url) throw new Error("no url");
    return url;
  };

  const copy = async () => {
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        const blob = mint().then((u) => new Blob([u], { type: "text/plain" }));
        await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
      } else {
        await navigator.clipboard.writeText(await mint());
      }
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2500);
  };

  return (
    <div className="-mt-3 mb-6 flex items-center justify-between gap-3">
      <p className="text-xs text-gray-400 leading-snug">
        Send {firstName} your personal link and SwiftCard can tell you when they come back.
      </p>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 whitespace-nowrap text-xs font-semibold px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 transition-colors"
      >
        {state === "copied" ? "Copied" : state === "failed" ? "Couldn't copy" : "Copy personal link"}
      </button>
    </div>
  );
}
