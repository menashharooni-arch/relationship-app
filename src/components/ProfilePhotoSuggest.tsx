"use client";

import { useState } from "react";

// "Suggest my profile picture" — drops in next to the headshot uploader in the
// card editors. Uses the user's own authorized LinkedIn connection (OpenID
// Connect userinfo) to fetch their profile photo, previews it, and applies it
// ONLY after they confirm. Manual upload is untouched, and an existing photo is
// never overwritten without that confirmation.
//
// Fails safe: when the LinkedIn app isn't configured the server pages pass
// enabled={false} and this renders nothing — never a broken button.
type Props = {
  /** LinkedIn OAuth is configured server-side (env keys present). */
  enabled: boolean;
  /** Called with the durable stored image URL once the user confirms. */
  onConfirm: (photoUrl: string) => void;
  /** Same-origin path to return to after the LinkedIn consent screen. */
  returnTo: string;
};

type State =
  | { kind: "idle" }
  | { kind: "loading" }                       // fetching the suggestion
  | { kind: "preview"; photo: string }        // suggested photo awaiting a decision
  | { kind: "connect" }                       // not connected yet
  | { kind: "reconnect" }                     // token expired / revoked
  | { kind: "none" }                          // connected but no photo available
  | { kind: "applying" }                      // importing the confirmed photo
  | { kind: "error"; message: string };

export default function ProfilePhotoSuggest({ enabled, onConfirm, returnTo }: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [applied, setApplied] = useState(false);

  if (!enabled) return null;

  const connectUrl = `/api/integrations/linkedin/connect?next=${encodeURIComponent(returnTo)}`;

  async function suggest() {
    setState({ kind: "loading" });
    setApplied(false);
    try {
      const res = await fetch("/api/integrations/linkedin");
      if (!res.ok) {
        setState(res.status === 501 ? { kind: "idle" } : { kind: "error", message: "Couldn't reach LinkedIn right now — try again, or upload a photo instead." });
        return;
      }
      const data = await res.json() as { connected?: boolean; photo?: string | null; error?: string };
      if (!data.connected) { setState({ kind: "connect" }); return; }
      if (data.photo) { setState({ kind: "preview", photo: data.photo }); return; }
      if (data.error === "revoked_or_no_photo" || data.error === "token_unreadable") {
        setState({ kind: "reconnect" });
      } else {
        setState({ kind: "none" });
      }
    } catch {
      setState({ kind: "error", message: "Couldn't reach LinkedIn right now — try again, or upload a photo instead." });
    }
  }

  async function useThisPhoto() {
    setState({ kind: "applying" });
    try {
      // Import copies the photo into our storage (LinkedIn CDN links expire) and
      // returns a durable URL; the caller saves it with the card on Save.
      const res = await fetch("/api/integrations/linkedin", { method: "POST" });
      const data = await res.json().catch(() => ({} as { url?: string; error?: string }));
      if (!res.ok || !data.url) {
        setState({ kind: "error", message: "Couldn't import the photo — try again, or upload it manually." });
        return;
      }
      onConfirm(data.url);
      setApplied(true);
      setState({ kind: "idle" });
    } catch {
      setState({ kind: "error", message: "Couldn't import the photo — try again, or upload it manually." });
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

      {state.kind === "loading" && <p className="text-xs text-gray-500">Looking for your profile photo…</p>}
      {state.kind === "applying" && <p className="text-xs text-gray-500">Adding your photo…</p>}

      {state.kind === "connect" && (
        <div className="mt-1.5 rounded-xl border border-gray-700/60 bg-gray-800/40 p-3">
          <p className="text-[11px] text-gray-400 mb-2">
            Connect your LinkedIn account to import your profile photo. You&apos;ll approve the photo before it&apos;s used.
          </p>
          <div className="flex items-center gap-3">
            <a href={connectUrl} className="text-xs bg-[#0A66C2] hover:bg-[#0956a5] text-white font-semibold px-3 py-1.5 rounded-full transition-colors">
              Connect LinkedIn
            </a>
            <button type="button" onClick={() => setState({ kind: "idle" })} className="text-[11px] text-gray-500 hover:text-gray-300">
              Cancel
            </button>
          </div>
        </div>
      )}

      {state.kind === "reconnect" && (
        <div className="mt-1.5 rounded-xl border border-amber-700/40 bg-amber-950/20 p-3">
          <p className="text-[11px] text-amber-300/90 mb-2">
            Your LinkedIn permission has expired. Reconnect to fetch your photo — or just upload one above.
          </p>
          <div className="flex items-center gap-3">
            <a href={connectUrl} className="text-xs bg-amber-500 hover:bg-amber-600 text-white font-semibold px-3 py-1.5 rounded-full transition-colors">
              Reconnect LinkedIn
            </a>
            <button type="button" onClick={() => setState({ kind: "idle" })} className="text-[11px] text-gray-500 hover:text-gray-300">
              Cancel
            </button>
          </div>
        </div>
      )}

      {state.kind === "none" && (
        <p className="text-[11px] text-gray-500 mt-1">
          We couldn&apos;t find a photo on your LinkedIn profile — upload one above instead.
          {" "}
          <button type="button" onClick={suggest} className="text-blue-400 hover:text-blue-300">Try again</button>
        </p>
      )}

      {state.kind === "error" && (
        <p className="text-[11px] text-gray-500 mt-1">
          {state.message}{" "}
          <button type="button" onClick={suggest} className="text-blue-400 hover:text-blue-300">Retry</button>
        </p>
      )}

      {state.kind === "preview" && (
        <div className="mt-1.5 rounded-xl border border-gray-700/60 bg-gray-800/40 p-3">
          <p className="text-[11px] text-gray-400 mb-2.5">Here&apos;s the photo from your LinkedIn profile:</p>
          <div className="flex items-center gap-3 mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={state.photo} alt="Suggested profile" className="w-16 h-16 rounded-full object-cover bg-gray-900" />
            <p className="text-[11px] text-gray-500">It&apos;s only used if you choose it below.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={useThisPhoto} className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold px-3 py-1.5 rounded-full transition-colors">
              Use this photo
            </button>
            <button type="button" onClick={() => setState({ kind: "idle" })} className="text-xs text-gray-400 hover:text-white border border-gray-700 px-3 py-1.5 rounded-full transition-colors">
              Upload a different photo
            </button>
            <button type="button" onClick={() => setState({ kind: "idle" })} className="text-[11px] text-gray-500 hover:text-gray-300 px-1">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
