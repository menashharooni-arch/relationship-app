// ── The shared creative pool ────────────────────────────────────────────────
//
// One rendered asset, used by both sides of marketing: Milo posts it organically
// and Addy runs it as a paid ad. Rendering the same concept twice would cost
// twice and let paid and organic drift apart visually, which is the opposite of
// looking like one brand.
//
// WHAT WAS BROKEN: the Higgsfield connector submitted a generation job and
// stored the job id in the queue item's payload — and nothing ever looked at it
// again. There was no polling, so the finished media URL was never recorded
// anywhere. Milo's videos were generated into the void, and a paid-ads agent had
// no asset to attach to an ad.
//
// This resolves pending jobs into `media_assets` rows with a real URL. It runs
// from the always-on watchdog loop (awake every 60s, self-renewing), which is
// the only reliable clock in the system.

import { sb } from "./agentkit.mjs";

/** Pull the finished media URL out of a provider status response. */
function extractUrl(body) {
  // Higgsfield's completed-job shape is not documented publicly and we have no
  // key to probe it with yet, so read defensively across the field names these
  // APIs conventionally use rather than betting on one. An unrecognised shape
  // leaves the job pending (and logs), which is recoverable; guessing wrong and
  // marking it ready with a null URL is not.
  const candidates = [
    body?.url, body?.result_url, body?.output_url, body?.video_url, body?.image_url,
    body?.result?.url, body?.output?.url, body?.data?.url,
    Array.isArray(body?.results) ? body.results[0]?.url : null,
    Array.isArray(body?.output) ? body.output[0]?.url : null,
    Array.isArray(body?.assets) ? body.assets[0]?.url : null,
  ];
  return candidates.find((u) => typeof u === "string" && /^https?:\/\//.test(u)) ?? null;
}

function isFailed(body) {
  const s = String(body?.status ?? body?.state ?? "").toLowerCase();
  return s === "failed" || s === "error" || s === "cancelled" || s === "canceled";
}

/**
 * Advance every pending asset. Returns a short summary for the loop's log.
 * Never throws — a provider hiccup must not disturb the watch.
 */
export async function pollMediaPool() {
  let pending;
  try {
    pending = await sb("GET", "media_assets", {
      params: "status=eq.pending&select=id,provider,provider_job,status_url,created_at&order=created_at.asc&limit=25",
    });
  } catch {
    return null; // table missing or REST error — nothing to do, stay quiet
  }
  if (!pending?.length) return null;

  const keyId = process.env.HIGGSFIELD_API_KEY_ID;
  const keySecret = process.env.HIGGSFIELD_API_KEY_SECRET;
  if (!keyId || !keySecret) return null; // no credentials → cannot resolve anything

  let ready = 0, failed = 0, stillPending = 0;
  for (const a of pending) {
    if (!a.status_url) { stillPending++; continue; }
    try {
      const res = await fetch(a.status_url, {
        headers: { Authorization: `Key ${keyId}:${keySecret}` },
      });
      if (!res.ok) { stillPending++; continue; }
      const body = await res.json().catch(() => null);
      const url = extractUrl(body);

      if (url) {
        await sb("PATCH", "media_assets", {
          params: `id=eq.${a.id}`,
          body: { status: "ready", url, ready_at: new Date().toISOString() },
        });
        ready++;
        continue;
      }
      if (isFailed(body)) {
        await sb("PATCH", "media_assets", {
          params: `id=eq.${a.id}`,
          body: { status: "failed", error: String(body?.error ?? body?.message ?? "provider reported failure").slice(0, 500) },
        });
        failed++;
        continue;
      }
      // A job older than 6 hours that still has no URL is not coming back.
      // Leaving it pending forever would poll it every minute indefinitely.
      if (Date.now() - new Date(a.created_at).getTime() > 6 * 60 * 60 * 1000) {
        await sb("PATCH", "media_assets", {
          params: `id=eq.${a.id}`,
          body: { status: "failed", error: "No result after 6 hours — abandoned." },
        });
        failed++;
        continue;
      }
      stillPending++;
    } catch {
      stillPending++;
    }
  }
  return { ready, failed, stillPending };
}

/** Assets ready to be posted or advertised. Both Milo and Addy read this. */
export async function readyAssets({ kind = null, limit = 20 } = {}) {
  try {
    const kindFilter = kind ? `&kind=eq.${kind}` : "";
    return (await sb("GET", "media_assets", {
      params: `status=eq.ready${kindFilter}&select=id,kind,concept,prompt,url,source_agent,ready_at&order=ready_at.desc&limit=${limit}`,
    })) ?? [];
  } catch {
    return [];
  }
}
