"use client";

import { useState } from "react";

// "Suggest my profile picture" — drops in next to the headshot uploader in the
// card editors. Gathers photo candidates from every outlet we can reach for the
// SIGNED-IN user's own identity:
//   • Google  — the avatar Google handed us at sign-in (no extra consent)
//   • Gravatar — the photo registered for their email
//   • LinkedIn — via the user's own authorized connection (OpenID userinfo)
// Everything is preview-first: a photo is applied ONLY after the user picks it.
// Manual upload is untouched, and an existing photo is never overwritten
// without that choice.
//
// LinkedIn fails safe: when the LinkedIn app isn't configured server-side the
// pages pass linkedinEnabled={false} and that source simply doesn't appear —
// Google/Gravatar still work.
type Props = {
  /** LinkedIn OAuth is configured server-side (env keys present). */
  linkedinEnabled: boolean;
  /** Called with the durable stored image URL once the user confirms. */
  onConfirm: (photoUrl: string) => void;
  /** Same-origin path to return to after the LinkedIn consent screen. */
  returnTo: string;
};

type Candidate = {
  source: "google" | "gravatar" | "linkedin";
  label: string;
  photoUrl: string;
};

// LinkedIn's extra states beyond "here's a photo".
type LinkedInState = "off" | "candidate" | "connect" | "reconnect" | "none" | "error";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "results"; candidates: Candidate[]; linkedin: LinkedInState }
  | { kind: "applying"; source: Candidate["source"] }
  | { kind: "error"; message: string };

export default function ProfilePhotoSuggest({ linkedinEnabled, onConfirm, returnTo }: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [applied, setApplied] = useState(false);

  const connectUrl = `/api/integrations/linkedin/connect?next=${encodeURIComponent(returnTo)}`;

  async function suggest() {
    setState({ kind: "loading" });
    setApplied(false);
    try {
      // Both sources in parallel; either failing alone must not sink the other.
      const [ownRes, liRes] = await Promise.all([
        fetch("/api/photo-suggest").catch(() => null),
        linkedinEnabled ? fetch("/api/integrations/linkedin").catch(() => null) : Promise.resolve(null),
      ]);

      const candidates: Candidate[] = [];
      if (ownRes?.ok) {
        const data = await ownRes.json() as { candidates?: Candidate[] };
        for (const c of data.candidates ?? []) candidates.push(c);
      }

      let linkedin: LinkedInState = linkedinEnabled ? "error" : "off";
      if (liRes) {
        if (liRes.ok) {
          const li = await liRes.json() as { connected?: boolean; photo?: string | null; error?: string };
          if (!li.connected) linkedin = "connect";
          else if (li.photo) {
            linkedin = "candidate";
            candidates.push({ source: "linkedin", label: "Your LinkedIn photo", photoUrl: li.photo });
          } else if (li.error === "revoked_or_no_photo" || li.error === "token_unreadable") linkedin = "reconnect";
          else linkedin = "none";
        } else if (liRes.status === 501) {
          linkedin = "off";
        }
      }

      if (!candidates.length && linkedin === "off") {
        setState({ kind: "error", message: "We couldn't find a photo on your accounts — upload one above instead." });
        return;
      }
      setState({ kind: "results", candidates, linkedin });
    } catch {
      setState({ kind: "error", message: "Couldn't look for photos right now — try again, or upload one instead." });
    }
  }

  async function useThisPhoto(c: Candidate) {
    setState({ kind: "applying", source: c.source });
    try {
      // Import copies the photo into our storage (source CDN links can expire)
      // and returns a durable URL; the caller saves it with the card on Save.
      const res = c.source === "linkedin"
        ? await fetch("/api/integrations/linkedin", { method: "POST" })
        : await fetch("/api/photo-suggest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ source: c.source }),
          });
      const data = await res.json().catch(() => ({} as { url?: string }));
      if (!res.ok || !data.url) {
        setState({ kind: "error", message: "Couldn't import that photo — try another, or upload it manually." });
        return;
      }
      onConfirm(data.url);
      setApplied(true);
      setState({ kind: "idle" });
    } catch {
      setState({ kind: "error", message: "Couldn't import that photo — try another, or upload it manually." });
    }
  }

  const linkBtn = "inline-flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors";

  return (
    <div className="mt-2">
      {state.kind === "idle" && (
        <button type="button" onClick={suggest} className={linkBtn}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3.5 h-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Suggest my profile picture
        </button>
      )}

      {applied && state.kind === "idle" && (
        <p className="text-[11px] text-emerald-400 mt-1">
          Photo added — it&apos;s saved when you save your card. Not right? Upload your own above.
        </p>
      )}

      {state.kind === "loading" && <p className="text-xs text-gray-500">Looking for your photo on Google, Gravatar{linkedinEnabled ? ", and LinkedIn" : ""}…</p>}
      {state.kind === "applying" && <p className="text-xs text-gray-500">Adding your photo…</p>}

      {state.kind === "error" && (
        <p className="text-[11px] text-gray-500 mt-1">
          {state.message}{" "}
          <button type="button" onClick={suggest} className="text-blue-400 hover:text-blue-300">Retry</button>
        </p>
      )}

      {state.kind === "results" && (
        <div className="mt-1.5 rounded-xl border border-gray-700/60 bg-gray-800/40 p-3">
          {state.candidates.length > 0 ? (
            <>
              <p className="text-[11px] text-gray-400 mb-2.5">
                {state.candidates.length === 1 ? "We found this photo — it's only used if you choose it:" : "We found these photos — pick one, or upload your own above:"}
              </p>
              <div className="flex flex-wrap gap-3 mb-1.5">
                {state.candidates.map((c) => (
                  <button
                    key={c.source}
                    type="button"
                    onClick={() => useThisPhoto(c)}
                    className="group flex flex-col items-center gap-1.5 rounded-xl border border-gray-700 hover:border-blue-500 bg-gray-900/60 px-3 py-2.5 transition-colors"
                    title={`Use ${c.label.toLowerCase()}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.photoUrl} alt={c.label} className="w-16 h-16 rounded-full object-cover bg-gray-900" />
                    <span className="text-[10px] text-gray-400 group-hover:text-white transition-colors">{c.label}</span>
                    <span className="text-[10px] font-semibold text-blue-400">Use this photo</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-[11px] text-gray-400 mb-2">
              No photo found on your Google account or Gravatar.
            </p>
          )}

          {state.linkedin === "connect" && (
            <div className="mt-1 pt-2 border-t border-gray-800 flex items-center gap-3 flex-wrap">
              <p className="text-[11px] text-gray-500">Also on LinkedIn? Connect to import your profile photo:</p>
              <a href={connectUrl} className="text-xs bg-[#0A66C2] hover:bg-[#0956a5] text-white font-semibold px-3 py-1.5 rounded-full transition-colors">
                Connect LinkedIn
              </a>
            </div>
          )}
          {state.linkedin === "reconnect" && (
            <div className="mt-1 pt-2 border-t border-gray-800 flex items-center gap-3 flex-wrap">
              <p className="text-[11px] text-amber-300/90">Your LinkedIn permission expired.</p>
              <a href={connectUrl} className="text-xs bg-amber-500 hover:bg-amber-600 text-white font-semibold px-3 py-1.5 rounded-full transition-colors">
                Reconnect LinkedIn
              </a>
            </div>
          )}
          {state.linkedin === "none" && (
            <p className="mt-1 pt-2 border-t border-gray-800 text-[11px] text-gray-500">
              Your LinkedIn profile has no photo we can import.
            </p>
          )}

          <div className="mt-2">
            <button type="button" onClick={() => setState({ kind: "idle" })} className="text-[11px] text-gray-500 hover:text-gray-300">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
