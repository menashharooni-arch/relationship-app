"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { PlanGate, PlanBadge } from "@/components/PlanGate";

const INTEGRATIONS_NATIVE_COPY =
  "Pro feature — Zapier, Google Contacts, and HubSpot are only available on the Pro plan.";

type Integration = "google" | "hubspot";

type Props = {
  googleConnected: boolean;
  hubspotConnected: boolean;
  googleSyncError?: string | null;
  hubspotSyncError?: string | null;
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
            <a href="/pricing" title="Upgrade to Pro to connect this integration" className="text-xs bg-[#1D4ED8] hover:bg-[#1740C4] text-white font-semibold px-2.5 py-1.5 rounded-full transition-colors shrink-0">Upgrade · Pro</a>
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

// HubSpot connects with a pasted Private App access token (see the /token
// route for why) instead of the OAuth redirect the other cards use, so it
// gets its own small form in place of a plain Connect link.
function HubSpotCard({
  connected: initialConnected,
  syncError,
  isPro,
  flashStatus,
}: {
  connected: boolean;
  syncError?: string | null;
  isPro: boolean;
  flashStatus?: string | null;
}) {
  const [connected, setConnected] = useState(initialConnected);
  const [showForm, setShowForm] = useState(!initialConnected);
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error" | "disconnecting">("idle");
  const [error, setError] = useState<string | null>(null);

  const needsReconnect = connected && !!syncError;

  async function save() {
    if (!token.trim()) return;
    setStatus("saving");
    setError(null);
    try {
      const res = await fetch("/api/integrations/hubspot/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
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
      setStatus("idle");
    } catch {
      setError("Couldn't reach SwiftCard. Try again.");
      setStatus("error");
    }
  }

  async function disconnect() {
    setStatus("disconnecting");
    try {
      await fetch("/api/integrations/hubspot", { method: "DELETE" });
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
          {HUBSPOT_LOGO}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-slate-900 font-semibold text-sm">HubSpot CRM</p>
            {needsReconnect ? (
              <span className="text-xs bg-amber-100 text-amber-700 font-medium px-2 py-0.5 rounded-full">Reconnect needed</span>
            ) : connected ? (
              <span className="text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full">Connected</span>
            ) : null}
          </div>
          <p className="text-slate-400 text-xs mt-0.5">New leads are automatically created as HubSpot contacts</p>
        </div>

        {!isPro ? (
          <PlanGate
            feature="integration-hubspot"
            nativeCopy={INTEGRATIONS_NATIVE_COPY}
            nativeContent={<span className="shrink-0"><PlanBadge tier="pro" /></span>}
          >
            <a href="/pricing" title="Upgrade to Pro to connect this integration" className="text-xs bg-[#1D4ED8] hover:bg-[#1740C4] text-white font-semibold px-2.5 py-1.5 rounded-full transition-colors shrink-0">Upgrade · Pro</a>
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
          <label className="text-xs text-slate-500 block">HubSpot Private App access token</label>
          <div className="flex gap-2">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="pat-na1-..."
              className="flex-1 min-w-0 bg-[#FAF7F2] border border-[#D4C8B8] text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#1D4ED8] transition-colors"
            />
            <button
              onClick={save}
              disabled={!token.trim() || status === "saving"}
              className="shrink-0 bg-[#1D4ED8] hover:bg-[#1740C4] disabled:opacity-50 text-white font-semibold px-4 py-2.5 rounded-full text-sm transition-colors"
            >
              {status === "saving" ? "Checking…" : "Save"}
            </button>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            In HubSpot: Settings → Integrations → Private Apps → Create a private app → grant the{" "}
            <code className="text-slate-600">crm.objects.contacts.write</code> scope → copy the access token here.
          </p>
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

export default function IntegrationsSettings({ googleConnected, hubspotConnected, googleSyncError, hubspotSyncError, isPro }: Props) {
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

      <HubSpotCard
        connected={hubspotConnected}
        syncError={hubspotSyncError}
        isPro={isPro}
        flashStatus={flashIntegration === "hubspot" ? flashStatus : null}
      />
    </div>
  );
}
