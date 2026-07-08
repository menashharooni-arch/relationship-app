"use client";

import { useRef, useState } from "react";
import { scanBusinessCard, ProRequiredError, type ScannedCard } from "@/lib/scan-card";

type ScannedData = ScannedCard;

type State = "idle" | "scanning" | "review" | "saving" | "done" | "error";

export default function CardScanner({ cardOwner }: { cardOwner: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>("idle");
  const [fields, setFields] = useState<ScannedData>({});
  const [errorMsg, setErrorMsg] = useState("");
  const [savedEmail, setSavedEmail] = useState("");
  const [sendingCard, setSendingCard] = useState(false);
  const [cardSent, setCardSent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function openModal() {
    setOpen(true);
    setState("idle");
    setFields({});
    setErrorMsg("");
    setCardSent(false);
  }

  function closeModal() {
    setOpen(false);
    setState("idle");
  }

  async function handleImage(file: File) {
    setState("scanning");
    // Reset the input so re-selecting the same photo fires onChange again.
    if (fileRef.current) fileRef.current.value = "";
    try {
      const data = await scanBusinessCard(file);
      setFields(data);
      setState("review");
    } catch (err) {
      if (err instanceof ProRequiredError) {
        setErrorMsg("Card scanner is a Pro feature. Upgrade to use it.");
      } else if (err instanceof DOMException && err.name === "AbortError") {
        setErrorMsg("That took too long. Try a clearer, closer photo of the card.");
      } else {
        setErrorMsg("Couldn't read that image. Try again with a clear, well-lit photo.");
      }
      setState("error");
    }
  }

  async function saveAsLead() {
    setState("saving");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_owner: cardOwner,
          name: fields.name || "Unknown",
          email: fields.email || "",
          phone: fields.phone || "",
          company: fields.company || "",
          message: `Title: ${fields.title || "—"} | Website: ${fields.website || "—"}`,
          tags: ["scanned"],
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setSavedEmail(fields.email || "");
      setState("done");
    } catch {
      setErrorMsg("Failed to save contact. Please try again.");
      setState("error");
    }
  }

  async function sendMyCard() {
    if (!savedEmail) return;
    setSendingCard(true);
    try {
      await fetch("/api/scanner/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toEmail: savedEmail }),
      });
      setCardSent(true);
    } catch { /* ignore */ } finally {
      setSendingCard(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={openModal}
        type="button"
        aria-label="Scan a business card"
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white active:text-white transition-colors px-2 py-2.5 -mx-1 rounded-lg hover:bg-gray-800/60 active:bg-gray-800 min-h-[44px] touch-manipulation"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 sm:w-4 sm:h-4 shrink-0">
          <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
        </svg>
        <span className="hidden sm:inline">Scan card</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={closeModal} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-sm mx-4 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden mb-4 sm:mb-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-white font-semibold text-sm">Scan a Business Card</h2>
            <p className="text-gray-400 text-xs mt-0.5">Photo → auto-extracted contact info</p>
          </div>
          <button onClick={closeModal} className="text-gray-500 hover:text-gray-300 transition-colors">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-5">
          {/* IDLE: pick image */}
          {state === "idle" && (
            <div className="space-y-3">
              {/* No `capture` attribute: on mobile this shows the native sheet
                  (Take Photo / Photo Library / Files) which opens reliably on
                  every device — forcing camera-only failed for some iOS/PWA
                  setups and blocked using an existing card photo. */}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImage(f); }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-3.5 rounded-full text-sm transition-colors touch-manipulation"
              >
                Take photo / Choose image
              </button>
              <p className="text-xs text-gray-500 text-center">
                Take a photo of a business card — or pick one from your library — and Claude AI will pull out the contact details.
              </p>
            </div>
          )}

          {/* SCANNING */}
          {state === "scanning" && (
            <div className="text-center py-6">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-300 font-medium">Reading card...</p>
              <p className="text-xs text-gray-500 mt-1">Claude AI is extracting contact info</p>
            </div>
          )}

          {/* REVIEW: edit fields */}
          {state === "review" && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400 font-medium mb-1">Review & edit extracted info</p>
              {(["name", "title", "company", "phone", "email", "website"] as (keyof ScannedData)[]).map((key) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 capitalize block mb-1">{key}</label>
                  <input
                    type={key === "email" ? "email" : key === "phone" ? "tel" : "text"}
                    value={fields[key] ?? ""}
                    onChange={(e) => setFields((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={`Enter ${key}`}
                    className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              ))}
              <button
                onClick={saveAsLead}
                disabled={!fields.name && !fields.email}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold py-3 rounded-full text-sm transition-colors mt-2"
              >
                Save as Contact
              </button>
              <button
                onClick={() => setState("idle")}
                className="w-full text-gray-500 text-sm hover:text-gray-300 transition-colors py-1"
              >
                Rescan
              </button>
            </div>
          )}

          {/* SAVING */}
          {state === "saving" && (
            <div className="text-center py-6">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-400">Saving contact...</p>
            </div>
          )}

          {/* DONE */}
          {state === "done" && (
            <div className="space-y-4">
              <div className="text-center py-2">
                <div className="w-10 h-10 rounded-full bg-green-900 flex items-center justify-center mx-auto mb-2">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-green-400">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-white font-semibold text-sm">Saved to your contacts!</p>
              </div>

              {savedEmail && !cardSent && (
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
                  <p className="text-xs text-gray-300 font-medium">Send them your card?</p>
                  <p className="text-xs text-gray-500">They&apos;ll receive your digital card link at <span className="text-gray-300">{savedEmail}</span></p>
                  <button
                    onClick={sendMyCard}
                    disabled={sendingCard}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-full text-sm transition-colors"
                  >
                    {sendingCard ? "Sending..." : "Send my card"}
                  </button>
                </div>
              )}

              {cardSent && (
                <p className="text-xs text-green-400 text-center font-medium">Card sent to {savedEmail}</p>
              )}

              <button
                onClick={closeModal}
                className="w-full text-gray-500 text-sm hover:text-gray-300 transition-colors py-1"
              >
                Close
              </button>
            </div>
          )}

          {/* ERROR */}
          {state === "error" && (
            <div className="space-y-3 text-center py-2">
              <p className="text-red-400 text-sm font-medium">{errorMsg}</p>
              <button
                onClick={() => setState("idle")}
                className="w-full border border-gray-700 text-gray-400 font-medium py-2.5 rounded-full text-sm hover:border-gray-600 transition-colors"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
