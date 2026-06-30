"use client";

import { useState } from "react";

type Props = {
  name: string;
  title: string;
  company: string;
  cardUrl: string;
  ogImageUrl: string; // the generated card image (used as the signature graphic)
};

// The rich-HTML signature the user pastes into Gmail/Outlook/Apple Mail: the card
// image (everything's already on it) linked to the card, plus a "Contact me" link.
function buildSignatureHtml({ name, cardUrl, ogImageUrl }: Props): string {
  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;"><tr><td style="padding:0;">
<a href="${cardUrl}" target="_blank" style="text-decoration:none;"><img src="${ogImageUrl}" alt="${name} — business card" width="360" style="display:block;border:0;border-radius:12px;" /></a>
<div style="margin-top:8px;font-size:14px;"><a href="${cardUrl}" target="_blank" style="color:#2563eb;text-decoration:none;font-weight:bold;">Contact me →</a></div>
</td></tr></table>`;
}

export default function EmailSignatureBox(props: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const sigHtml = buildSignatureHtml(props);

  async function copy() {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([sigHtml], { type: "text/html" }),
          "text/plain": new Blob([`${props.name}\n${props.cardUrl}`], { type: "text/plain" }),
        }),
      ]);
    } catch {
      try { await navigator.clipboard.writeText(sigHtml); } catch { /* ignore */ }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <>
      {/* Dashboard card */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left bg-gray-900 border border-gray-800/80 rounded-2xl p-5 hover:border-gray-700 transition-colors group"
      >
        <p className="text-white font-semibold text-sm flex items-center gap-1.5">
          <span>✉️</span> Email signature
        </p>
        <p className="text-gray-500 text-[11px] mt-1 leading-relaxed">
          Copy this and use it as your email signature — your card in every email you send.
        </p>

        <div className="mt-3 rounded-xl overflow-hidden border border-gray-700/60 bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={props.ogImageUrl} alt="Your card" className="w-full block" />
        </div>

        <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400 group-hover:text-blue-300">
          Preview &amp; copy →
        </span>
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <p className="text-white font-semibold text-sm">Your email signature</p>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-gray-500 hover:text-white transition-colors">✕</button>
            </div>

            <div className="p-5">
              <p className="text-gray-500 text-xs mb-3">Here&apos;s how it looks at the bottom of an email you send:</p>

              {/* Fake email window */}
              <div className="rounded-xl border border-gray-700/60 bg-white overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-200 text-[12px] text-gray-500 space-y-0.5">
                  <p><span className="text-gray-400">To:</span> sarah@acme.com</p>
                  <p><span className="text-gray-400">Subject:</span> Great connecting today</p>
                </div>
                <div className="px-4 py-3 text-[13px] text-gray-800 leading-relaxed">
                  <p>Hi Sarah,</p>
                  <p className="mt-2">Really enjoyed chatting earlier — here&apos;s my card so you have everything in one place.</p>
                  <p className="mt-2">Talk soon,</p>
                  {/* Signature: the card image (clickable) + Contact me link */}
                  <div className="mt-3">
                    <a href={props.cardUrl} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={props.ogImageUrl} alt="card" width={300} className="block rounded-[12px]" />
                    </a>
                    <a href={props.cardUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-[14px] font-bold text-blue-600 no-underline">
                      Contact me →
                    </a>
                  </div>
                </div>
              </div>

              <button
                onClick={copy}
                className="w-full mt-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm py-2.5 rounded-full transition-colors"
              >
                {copied ? "Copied ✓ — now paste it into your email signature" : "Copy signature"}
              </button>
              <p className="text-gray-600 text-[11px] mt-2 text-center">
                Paste into <strong className="text-gray-400">Gmail → Settings → Signature</strong> (or Outlook / Apple Mail). The card image links straight to your SwiftCard.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
