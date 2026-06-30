"use client";

import { useState } from "react";

type Props = {
  name: string;
  company: string;
  cardUrl: string;
  ogUrl: string; // server-rendered card image for THIS card (per username)
};

function buildSignatureHtml(name: string, company: string, cardUrl: string, imgUrl: string): string {
  const header = `<div style="font-size:14px;color:#111827;margin-bottom:6px;"><strong>${name}</strong>${company ? ` | ${company}` : ""}</div>`;
  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;"><tr><td style="padding:0;">
${header}
<a href="${cardUrl}" target="_blank" style="text-decoration:none;"><img src="${imgUrl}" alt="${name} — business card" width="360" style="display:block;border:0;border-radius:12px;" /></a>
<div style="margin-top:8px;font-size:14px;"><a href="${cardUrl}" target="_blank" style="color:#2563eb;text-decoration:none;font-weight:bold;">Contact me →</a></div>
</td></tr></table>`;
}

export default function EmailSignatureBox({ name, company, cardUrl, ogUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [bust, setBust] = useState(0); // bump to force a fresh image after card edits
  const displaySrc = bust ? `${ogUrl}?v=${bust}` : ogUrl;

  async function copy() {
    // A unique URL per copy so the recipient is never served a stale cached image,
    // and the image + links always reflect the current card.
    const fresh = `${ogUrl}?v=${Date.now()}`;
    const html = buildSignatureHtml(name, company, cardUrl, fresh);
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([`${name}\n${cardUrl}`], { type: "text/plain" }),
        }),
      ]);
    } catch {
      try { await navigator.clipboard.writeText(html); } catch { /* ignore */ }
    }
    setBust(Date.now()); // refresh the on-screen preview too
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left bg-gray-900 border border-gray-800/80 rounded-2xl p-5 hover:border-gray-700 transition-colors group"
      >
        <p className="text-white font-semibold text-sm flex items-center gap-1.5"><span>✉️</span> Email signature</p>
        <p className="text-gray-500 text-[11px] mt-1 leading-relaxed">
          Copy this and use it as your email signature — your card in every email you send.
        </p>
        <div className="mt-3 rounded-xl border border-gray-700/60 bg-white overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={displaySrc} alt="Your card" className="w-full block" />
        </div>
        <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400 group-hover:text-blue-300">Preview &amp; copy →</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <p className="text-white font-semibold text-sm">Your email signature</p>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-gray-500 hover:text-white transition-colors">✕</button>
            </div>

            <div className="p-5">
              <p className="text-gray-500 text-xs mb-3">Here&apos;s how it looks at the bottom of an email you send:</p>

              <div className="rounded-xl border border-gray-700/60 bg-white overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-200 text-[12px] text-gray-500 space-y-0.5">
                  <p><span className="text-gray-400">To:</span> sarah@acme.com</p>
                  <p><span className="text-gray-400">Subject:</span> Great connecting today</p>
                </div>
                <div className="px-4 py-3 text-[13px] text-gray-800 leading-relaxed">
                  <p>Hi Sarah,</p>
                  <p className="mt-2">Really enjoyed chatting earlier — here&apos;s my card so you have everything in one place.</p>
                  <p className="mt-2">Talk soon,</p>
                  <div className="mt-3">
                    <p className="text-[14px] text-gray-900 mb-1.5"><strong>{name}</strong>{company ? ` | ${company}` : ""}</p>
                    <a href={cardUrl} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={displaySrc} alt="card" className="block rounded-[12px] w-full" />
                    </a>
                    <a href={cardUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-[14px] font-bold text-blue-600 no-underline">Contact me →</a>
                  </div>
                </div>
              </div>

              <button onClick={copy}
                className="w-full mt-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm py-2.5 rounded-full transition-colors">
                {copied ? "Copied ✓ — paste it into your email signature" : "Copy signature"}
              </button>
              <p className="text-gray-600 text-[11px] mt-2 text-center">
                Paste into <strong className="text-gray-400">Gmail → Settings → Signature</strong>. The image + link always point to your current card.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
