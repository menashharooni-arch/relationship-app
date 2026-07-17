"use client";

import { useState } from "react";
import CopyButton from "@/components/CopyButton";

// Program a physical NFC tag so a tap opens this card. Web NFC can WRITE tags
// only on Android Chrome; everywhere else (iPhone especially) we hand the user
// the link to write with a free NFC app. Either way the tag just holds the card
// URL — which already works — so there's nothing server-side to "turn on".
type Status = "idle" | "writing" | "done" | "error" | "unsupported";

export default function NFCWriter({ url }: { url: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [msg, setMsg] = useState("");
  // Tag taps get their own analytics source (the dashboard's traffic-source
  // breakdown already knows "nfc_card") — appended only if the caller didn't
  // pass query params of its own.
  const tagUrl = url.includes("?") ? url : `${url}?source=nfc_card`;

  async function write() {
    if (typeof window === "undefined" || !("NDEFReader" in window)) {
      setStatus("unsupported");
      return;
    }
    setStatus("writing");
    setMsg("Hold a blank NFC tag against the back of your phone…");
    try {
      const Reader = (window as unknown as { NDEFReader: new () => { write: (m: unknown) => Promise<void> } }).NDEFReader;
      const reader = new Reader();
      await reader.write({ records: [{ recordType: "url", data: tagUrl }] });
      setStatus("done");
      setMsg("Done! Tapping this tag now opens your card.");
    } catch (e) {
      setStatus("error");
      const m = e instanceof Error ? e.message : "";
      setMsg(/cancel|abort/i.test(m)
        ? "Canceled — tap “Write to a tag” again when you’re ready."
        : "Couldn’t write. Turn NFC on, and use a blank or rewritable tag.");
    }
  }

  return (
    <div>
      <p className="text-gray-300 text-[13px] leading-relaxed mb-3">
        Buy any blank NFC tag or card, write your link to it once, then a phone tap opens your card — no app for them.
      </p>

      <button
        type="button"
        onClick={write}
        disabled={status === "writing"}
        className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-60 rounded-full py-2.5 transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 8.32a7.43 7.43 0 010 7.36M9 5.5a11 11 0 010 13M4.5 12h.01" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 4.5v15a2 2 0 002 2h3a2 2 0 002-2v-15a2 2 0 00-2-2h-3a2 2 0 00-2 2z" />
        </svg>
        {status === "writing" ? "Waiting for a tag…" : "Write to a tag"}
      </button>

      {status !== "idle" && status !== "unsupported" && (
        <p className={`text-xs mt-2 ${status === "done" ? "text-emerald-400" : status === "error" ? "text-amber-400" : "text-gray-400"}`}>
          {msg}
        </p>
      )}

      {status === "unsupported" && (
        <p className="text-xs mt-2 text-amber-400/90 leading-relaxed">
          Writing tags from the browser works on Android Chrome. On iPhone (or here), use a free app like <strong className="text-amber-200">NFC Tools</strong> and write the link below.
        </p>
      )}

      {/* Manual path — always available (iPhone, desktop, unsupported browsers) */}
      <div className="mt-3 pt-3 border-t border-gray-800">
        <p className="text-gray-500 text-[11px] mb-1.5">Or write it yourself with an NFC app — use this link:</p>
        <div className="flex items-center gap-2 bg-gray-800/60 border border-gray-700/60 rounded-xl px-3 py-2.5">
          <span className="text-blue-400 text-xs truncate flex-1">{tagUrl.replace(/^https?:\/\//, "")}</span>
          <CopyButton text={tagUrl} />
        </div>
      </div>
    </div>
  );
}
