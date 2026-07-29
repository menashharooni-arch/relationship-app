"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { PlanGate, PlanBadge } from "@/components/PlanGate";

const INTEGRATIONS_NATIVE_COPY =
  "Pro feature — Zapier, Google Contacts, and HubSpot are only available on the Pro plan.";

type Integration = "google" | "hubspot" | "pipedrive" | "highlevel";

type Props = {
  googleConnected: boolean;
  hubspotConnected: boolean;
  pipedriveConnected: boolean;
  highlevelConnected: boolean;
  googleSyncError?: string | null;
  hubspotSyncError?: string | null;
  pipedriveSyncError?: string | null;
  highlevelSyncError?: string | null;
  isPro: boolean;
};

function IntegrationCard({
  name,
  description,
  logo,
  connected: initialConnected,
  syncError,
  connectUrl,
  disconnectUrl,
  isPro,
  flashStatus,
  proGated = true,
}: {
  name: string;
  description: string;
  logo: React.ReactNode;
  connected: boolean;
  syncError?: string | null;
  connectUrl: string;
  disconnectUrl: string;
  isPro: boolean;
  flashStatus?: string | null;
  /** When false the card ignores plan gating (available to all signed-in users).
      LinkedIn photo import is a card-building aid, not a Pro CRM sync. */
  proGated?: boolean;
}) {
  // Treat a non-Pro-gated card as always "unlocked" regardless of plan.
  const unlocked = isPro || !proGated;
  const [connected, setConnected] = useState(initialConnected);
  const [disconnecting, setDisconnecting] = useState(false);

  async function disconnect() {
    setDisconnecting(true);
    try {
      await fetch(disconnectUrl, { method: "DELETE" });
      setConnected(false);
    } catch { /* ignore */ } finally {
      setDisconnecting(false);
    }
  }

  const needsReconnect = connected && !!syncError;

  return (
    <div className={`bg-[#EDE5D8] border rounded-2xl px-5 py-4 shadow-sm ${!unlocked ? "opacity-60" : ""}`}
      style={{ borderColor: needsReconnect ? "#fcd34d" : connected ? "#86efac" : "#D4C8B8" }}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#F0EBE1] border border-[#D4C8B8] flex items-center justify-center shrink-0">
          {logo}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-slate-900 font-semibold text-sm">{name}</p>
            {needsReconnect ? (
              <span className="text-xs bg-amber-100 text-amber-700 font-medium px-2 py-0.5 rounded-full">Reconnect needed</span>
            ) : connected ? (
              <span className="text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full">Connected</span>
            ) : null}
          </div>
          <p className="text-slate-400 text-xs mt-0.5">{description}</p>
        </div>

        {unlocked ? (
          needsReconnect ? (
            <a
              href={connectUrl}
              className="text-xs bg-amber-500 hover:bg-amber-600 text-white font-semibold px-3 py-1.5 rounded-full transition-colors shrink-0"
            >
              Reconnect
            </a>
          ) : connected ? (
            <button
              onClick={disconnect}
              disabled={disconnecting}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors font-medium shrink-0"
            >
              {disconnecting ? "..." : "Disconnect"}
            </button>
          ) : (
            <a
              href={connectUrl}
              className="text-xs bg-[#1D4ED8] hover:bg-[#1740C4] text-white font-semibold px-3 py-1.5 rounded-full transition-colors shrink-0"
            >
              Connect
            </a>
          )
        ) : (
          <PlanGate
            feature="integration-google"
            nativeCopy={INTEGRATIONS_NATIVE_COPY}
            nativeContent={<span className="shrink-0"><PlanBadge tier="pro" /></span>}
          >
            <a href="/upgrade" title="Upgrade to Pro to connect this integration" className="text-xs bg-[#1D4ED8] hover:bg-[#1740C4] text-white font-semibold px-2.5 py-1.5 rounded-full transition-colors shrink-0">Upgrade · Pro</a>
          </PlanGate>
        )}
      </div>

      {needsReconnect && (
        <p className="text-xs text-amber-700 mt-2">{syncError}</p>
      )}
      {flashStatus === "connected" && (
        <p className="text-xs text-green-600 font-medium mt-2">Successfully connected!</p>
      )}
      {flashStatus === "error" && (
        <p className="text-xs text-red-500 mt-2">Connection failed. Check your app credentials and try again.</p>
      )}
    </div>
  );
}

const HUBSPOT_LOGO = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#ff7a59">
    <path d="M18.164 7.93V5.084a2.198 2.198 0 0 0 1.268-1.978V3.04A2.2 2.2 0 0 0 17.236.84h-.065a2.2 2.2 0 0 0-2.197 2.2v.066a2.198 2.198 0 0 0 1.268 1.978V7.93a6.232 6.232 0 0 0-2.962 1.303L5.85 3.845a2.44 2.44 0 0 0 .085-.624 2.451 2.451 0 1 0-2.451 2.45c.463 0 .894-.13 1.263-.353l7.36 5.32a6.232 6.232 0 0 0-.005 7.024l-2.24 2.24a1.944 1.944 0 0 0-.568-.088 1.96 1.96 0 1 0 1.96 1.96 1.944 1.944 0 0 0-.088-.568l2.215-2.215a6.248 6.248 0 1 0 4.723-11.06zm-.892 9.338a3.1 3.1 0 1 1 0-6.2 3.1 3.1 0 0 1 0 6.2z"/>
  </svg>
);

const PIPEDRIVE_LOGO = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#017737" aria-hidden="true">
    <path d="M13.1 3.2c-1.79 0-3.02.79-3.71 1.68-.04-.5-.36-1.44-1.93-1.44H5.09v3.02h1.1c.24 0 .32.08.32.32v14.02h3.36v-6.06c0-.29-.02-.53-.03-.63.63.75 1.79 1.52 3.45 1.52 3.13 0 5.35-2.45 5.35-6.26 0-3.86-2.09-6.17-5.54-6.17zm-.72 9.6c-1.9 0-2.79-1.78-2.79-3.4 0-2.55 1.4-3.44 2.72-3.44 1.63 0 2.75 1.36 2.75 3.42 0 2.15-1.27 3.42-2.68 3.42z"/>
  </svg>
);

const HIGHLEVEL_LOGO = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#2a9d8f" aria-hidden="true">
    <path d="M12 2 3 7v10l9 5 9-5V7l-9-5zm0 2.3 6.9 3.8-6.9 3.8-6.9-3.8L12 4.3zM5 9.4l6 3.3v6.6l-6-3.3V9.4zm8 9.9v-6.6l6-3.3v6.6l-6 3.3z"/>
  </svg>
);

// HubSpot connects with a pasted Private App access token (see the /token
// route for why) instead of the OAuth redirect the other cards use, so it
// gets its own small form in place of a plain Connect link.
// Paste-a-token integrations (HubSpot, Pipedrive — HighLevel next) are the same
// card with different words. Generalised rather than copied: this file would
// otherwise hold three then four identical 145-line components, which is the
// same trap the sync files fell into, where one fix landed in one copy and not
// the other. Every HubSpot value below is passed in verbatim from the call
// site, so its rendering is byte-for-byte what it was.
function TokenCard({
  provider,
  title,
  description,
  logo,
  saveEndpoint,
  disconnectEndpoint,
  tokenLabel,
  placeholder,
  help,
  extra,
  connected: initialConnected,
  syncError,
  isPro,
  flashStatus,
}: {
  provider: string;
  title: string;
  description: string;
  logo: React.ReactNode;
  /**
   * POST here to save. Kept SEPARATE from disconnectEndpoint because HubSpot
   * splits them: POST lives at /hubspot/token and DELETE at /hubspot, and those
   * routes export only their own verb. Collapsing them into one prop sent
   * DELETE to a route with no DELETE handler — a 405 that the disconnect
   * catch swallowed, so the card flipped to "disconnected" while the row stayed
   * in the database and leads kept syncing. Providers that serve both verbs
   * from one path simply pass the same value twice.
   */
  saveEndpoint: string;
  disconnectEndpoint: string;
  tokenLabel: string;
  placeholder: string;
  help: React.ReactNode;
  /**
   * Second value some providers need alongside the token. HighLevel is the
   * case: a Private Integration token isn't scoped to a sub-account, so the
   * Location ID has to be supplied too. Omitted for everyone else.
   */
  extra?: { label: string; placeholder: string };
  connected: boolean;
  syncError?: string | null;
  isPro: boolean;
  flashStatus?: string | null;
}) {
  const [connected, setConnected] = useState(initialConnected);
  const [showForm, setShowForm] = useState(!initialConnected);
  const [token, setToken] = useState("");
  const [extraValue, setExtraValue] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error" | "disconnecting">("idle");
  const [error, setError] = useState<string | null>(null);

  const needsReconnect = connected && !!syncError;

  // Both values are required when a provider needs a second one — saving with
  // only the token would store a connection that fails on every lead.
  const canSave = !!token.trim() && (!extra || !!extraValue.trim());

  async function save() {
    if (!canSave) return;
    setStatus("saving");
    setError(null);
    try {
      const res = await fetch(saveEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...(extra ? { extra: extraValue } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "Couldn't connect. Try again.");
        setStatus("error");
        return;
      }
      setConnected(true);
      setShowForm(false);
      setToken("");
      setExtraValue("");
      setStatus("idle");
    } catch {
      setError("Couldn't reach SwiftCard. Try again.");
      setStatus("error");
    }
  }

  async function disconnect() {
    setStatus("disconnecting");
    try {
      await fetch(disconnectEndpoint, { method: "DELETE" });
      setConnected(false);
      setShowForm(true);
    } catch { /* ignore */ } finally {
      setStatus("idle");
    }
  }

  return (
    <div className={`bg-[#EDE5D8] border rounded-2xl px-5 py-4 shadow-sm ${!isPro ? "opacity-60" : ""}`}
      style={{ borderColor: needsReconnect ? "#fcd34d" : connected ? "#86efac" : "#D4C8B8" }}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#F0EBE1] border border-[#D4C8B8] flex items-center justify-center shrink-0">
          {logo}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-slate-900 font-semibold text-sm">{title}</p>
            {needsReconnect ? (
              <span className="text-xs bg-amber-100 text-amber-700 font-medium px-2 py-0.5 rounded-full">Reconnect needed</span>
            ) : connected ? (
              <span className="text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full">Connected</span>
            ) : null}
          </div>
          <p className="text-slate-400 text-xs mt-0.5">{description}</p>
        </div>

        {!isPro ? (
          <PlanGate
            feature={`integration-${provider}`}
            nativeCopy={INTEGRATIONS_NATIVE_COPY}
            nativeContent={<span className="shrink-0"><PlanBadge tier="pro" /></span>}
          >
            <a href="/upgrade" title="Upgrade to Pro to connect this integration" className="text-xs bg-[#1D4ED8] hover:bg-[#1740C4] text-white font-semibold px-2.5 py-1.5 rounded-full transition-colors shrink-0">Upgrade · Pro</a>
          </PlanGate>
        ) : connected && !showForm ? (
          <button
            onClick={disconnect}
            disabled={status === "disconnecting"}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors font-medium shrink-0"
          >
            {status === "disconnecting" ? "..." : "Disconnect"}
          </button>
        ) : !connected && !showForm ? (
          <button onClick={() => setShowForm(true)} className="text-xs bg-[#1D4ED8] hover:bg-[#1740C4] text-white font-semibold px-3 py-1.5 rounded-full transition-colors shrink-0">
            Connect
          </button>
        ) : null}
      </div>

      {isPro && needsReconnect && !showForm && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-xs text-amber-700">{syncError}</p>
          <button onClick={() => setShowForm(true)} className="text-xs bg-amber-500 hover:bg-amber-600 text-white font-semibold px-3 py-1.5 rounded-full transition-colors shrink-0">
            Reconnect
          </button>
        </div>
      )}

      {isPro && showForm && (
        <div className="mt-3 space-y-2">
          <label className="text-xs text-slate-500 block">{tokenLabel}</label>
          <div className="flex gap-2">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={placeholder}
              className="flex-1 min-w-0 bg-[#FAF7F2] border border-[#D4C8B8] text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#1D4ED8] transition-colors"
            />
            <button
              onClick={save}
              disabled={!canSave || status === "saving"}
              className="shrink-0 bg-[#1D4ED8] hover:bg-[#1740C4] disabled:opacity-50 text-white font-semibold px-4 py-2.5 rounded-full text-sm transition-colors"
            >
              {status === "saving" ? "Checking…" : "Save"}
            </button>
          </div>
          {extra && (
            <>
              <label className="text-xs text-slate-500 block pt-1">{extra.label}</label>
              <input
                type="text"
                value={extraValue}
                onChange={(e) => setExtraValue(e.target.value)}
                placeholder={extra.placeholder}
                className="w-full bg-[#FAF7F2] border border-[#D4C8B8] text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#1D4ED8] transition-colors"
              />
            </>
          )}
          <p className="text-slate-400 text-[11px] leading-relaxed">{help}</p>
          {connected && (
            <button onClick={() => { setShowForm(false); setError(null); }} className="text-slate-400 hover:text-slate-600 text-xs font-medium transition-colors">
              Cancel
            </button>
          )}
          {error && <p className="text-red-500 text-xs">{error}</p>}
        </div>
      )}

      {flashStatus === "connected" && (
        <p className="text-xs text-green-600 font-medium mt-2">Successfully connected!</p>
      )}
    </div>
  );
}

export default function IntegrationsSettings({ googleConnected, hubspotConnected, pipedriveConnected, highlevelConnected, googleSyncError, hubspotSyncError, pipedriveSyncError, highlevelSyncError, isPro }: Props) {
  const searchParams = useSearchParams();
  const [flashIntegration, setFlashIntegration] = useState<Integration | null>(null);
  const [flashStatus, setFlashStatus] = useState<string | null>(null);

  useEffect(() => {
    const integration = searchParams.get("integration") as Integration | null;
    const status = searchParams.get("status");
    if (integration && status) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of OAuth callback query params
      setFlashIntegration(integration);
      setFlashStatus(status);
      setTimeout(() => { setFlashIntegration(null); setFlashStatus(null); }, 5000);
    }
  }, [searchParams]);

  return (
    <div className="space-y-3">
      <IntegrationCard
        name="Google Contacts"
        description="New leads are automatically added to your Google Contacts"
        logo={
          <svg viewBox="0 0 24 24" className="w-5 h-5">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        }
        connected={googleConnected}
        syncError={googleSyncError}
        connectUrl="/api/integrations/google/connect"
        disconnectUrl="/api/integrations/google"
        isPro={isPro}
        flashStatus={flashIntegration === "google" ? flashStatus : null}
      />

      <TokenCard
        provider="hubspot"
        title="HubSpot CRM"
        description="New leads are automatically created as HubSpot contacts"
        logo={HUBSPOT_LOGO}
        saveEndpoint="/api/integrations/hubspot/token"
        disconnectEndpoint="/api/integrations/hubspot"
        tokenLabel="HubSpot Private App access token"
        placeholder="pat-na1-..."
        help={
          <>
            In HubSpot: Settings → Integrations → Private Apps → Create a private app → grant the{" "}
            <code className="text-slate-600">crm.objects.contacts.write</code> scope → copy the access token here.
          </>
        }
        connected={hubspotConnected}
        syncError={hubspotSyncError}
        isPro={isPro}
        flashStatus={flashIntegration === "hubspot" ? flashStatus : null}
      />

      <TokenCard
        provider="pipedrive"
        title="Pipedrive"
        description="New leads become Pipedrive people, with a note on where you met"
        logo={PIPEDRIVE_LOGO}
        saveEndpoint="/api/integrations/pipedrive/token"
        disconnectEndpoint="/api/integrations/pipedrive/token"
        tokenLabel="Pipedrive personal API token"
        placeholder="Paste your API token"
        help={
          <>
            In Pipedrive: click your name (top right) → Company settings → Personal preferences →{" "}
            <code className="text-slate-600">API</code> → copy your personal API token here. If it&apos;s
            not there, your Pipedrive admin may have API access switched off for your permission set.
          </>
        }
        connected={pipedriveConnected}
        syncError={pipedriveSyncError}
        isPro={isPro}
        flashStatus={flashIntegration === "pipedrive" ? flashStatus : null}
      />

      <TokenCard
        provider="highlevel"
        title="GoHighLevel"
        description="New leads are upserted into your sub-account and tagged, so your workflows fire"
        logo={HIGHLEVEL_LOGO}
        saveEndpoint="/api/integrations/highlevel/token"
        disconnectEndpoint="/api/integrations/highlevel/token"
        tokenLabel="Private Integration token"
        placeholder="pit-..."
        extra={{ label: "Location ID (sub-account)", placeholder: "e.g. ve9EPM428h8vShlRW1KT" }}
        help={
          <>
            In HighLevel: Settings → Private Integrations → Create new Integration → tick{" "}
            <code className="text-slate-600">contacts.write</code> → copy the token. Your Location ID is
            the long code in the browser address bar while you&apos;re inside that sub-account, right
            after <code className="text-slate-600">/location/</code>.
          </>
        }
        connected={highlevelConnected}
        syncError={highlevelSyncError}
        isPro={isPro}
        flashStatus={flashIntegration === "highlevel" ? flashStatus : null}
      />
    </div>
  );
}
