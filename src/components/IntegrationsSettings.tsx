"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

type Integration = "google" | "hubspot" | "linkedin";

type Props = {
  googleConnected: boolean;
  hubspotConnected: boolean;
  googleSyncError?: string | null;
  hubspotSyncError?: string | null;
  isPro: boolean;
  /** HubSpot OAuth env keys present — hide the card entirely when not configured
      so users never hit a broken Connect redirect. */
  hubspotEnabled?: boolean;
  /** LinkedIn OAuth env keys present — hide the card when not configured (the
      app isn't approved yet), mirroring how HubSpot is gated. */
  linkedinEnabled?: boolean;
  linkedinConnected?: boolean;
  linkedinSyncError?: string | null;
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
          <span className="text-xs bg-[#D4C8B8] text-[#6B5F52] font-medium px-2 py-0.5 rounded-full shrink-0">Pro</span>
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

export default function IntegrationsSettings({ googleConnected, hubspotConnected, googleSyncError, hubspotSyncError, isPro, hubspotEnabled = false, linkedinEnabled = false, linkedinConnected = false, linkedinSyncError = null }: Props) {
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

      {hubspotEnabled && (
      <IntegrationCard
        name="HubSpot CRM"
        description="New leads are automatically created as HubSpot contacts"
        logo={
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#ff7a59">
            <path d="M18.164 7.93V5.084a2.198 2.198 0 0 0 1.268-1.978V3.04A2.2 2.2 0 0 0 17.236.84h-.065a2.2 2.2 0 0 0-2.197 2.2v.066a2.198 2.198 0 0 0 1.268 1.978V7.93a6.232 6.232 0 0 0-2.962 1.303L5.85 3.845a2.44 2.44 0 0 0 .085-.624 2.451 2.451 0 1 0-2.451 2.45c.463 0 .894-.13 1.263-.353l7.36 5.32a6.232 6.232 0 0 0-.005 7.024l-2.24 2.24a1.944 1.944 0 0 0-.568-.088 1.96 1.96 0 1 0 1.96 1.96 1.944 1.944 0 0 0-.088-.568l2.215-2.215a6.248 6.248 0 1 0 4.723-11.06zm-.892 9.338a3.1 3.1 0 1 1 0-6.2 3.1 3.1 0 0 1 0 6.2z"/>
          </svg>
        }
        connected={hubspotConnected}
        syncError={hubspotSyncError}
        connectUrl="/api/integrations/hubspot/connect"
        disconnectUrl="/api/integrations/hubspot"
        isPro={isPro}
        flashStatus={flashIntegration === "hubspot" ? flashStatus : null}
      />
      )}

      {linkedinEnabled && (
      <IntegrationCard
        name="LinkedIn"
        description="Import your LinkedIn profile photo onto your card — you approve it before it's applied"
        proGated={false}
        logo={
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#0A66C2">
            <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z"/>
          </svg>
        }
        connected={linkedinConnected}
        syncError={linkedinSyncError}
        connectUrl="/api/integrations/linkedin/connect"
        disconnectUrl="/api/integrations/linkedin"
        isPro={isPro}
        flashStatus={flashIntegration === "linkedin" ? flashStatus : null}
      />
      )}
    </div>
  );
}
