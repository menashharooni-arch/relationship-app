// Production health check — the credential-free half of the monitoring story.
//
// WHY THIS EXISTS: the Sentry stack (error reporting, daily triage, auto-rollback)
// is written and merged but dormant, because every piece of it needs an account
// and API tokens that only the owner can create. That left production with error
// CAPTURE (reportError -> Vercel logs) but no alerting: if swiftcard.me went down
// at 2am, nothing and nobody would say so.
//
// This needs nothing. No DSN, no token, no third-party account. It asks the live
// site a handful of questions the way a real visitor would, and the workflow that
// runs it opens a GitHub issue when an answer is wrong — which emails you.
//
// Deliberately checks BEHAVIOUR, not just status codes. A 200 that renders an
// empty card page is still an outage to the person holding the phone.
//
// Exit code is always 0: the workflow reads the JSON on stdout and decides. A
// non-zero exit here would fail the job before it could open the issue.

const BASE = process.env.HEALTH_BASE_URL || "https://swiftcard.me";
const DEMO = "demo-sales";

/** Transient blips are not outages. Every check gets three tries before it counts. */
async function attempt(fn, tries = 3) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fn();
      if (r.ok) return r;
      last = r;
    } catch (e) {
      last = { ok: false, detail: `threw: ${String(e.message).slice(0, 120)}` };
    }
    if (i < tries) await new Promise((r) => setTimeout(r, 4000 * i));
  }
  return last;
}

const get = async (path, init) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    return await fetch(BASE + path, { ...init, signal: ctrl.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
};

const CHECKS = [
  {
    name: "homepage renders",
    run: async () => {
      const res = await get("/");
      const body = await res.text();
      const ok = res.status === 200 && /SwiftCard/i.test(body);
      return { ok, detail: `status ${res.status}, ${body.length} bytes` };
    },
  },
  {
    name: "public card page renders",
    run: async () => {
      const res = await get(`/card/${DEMO}`);
      const body = await res.text();
      // The name must actually be in the HTML — a 200 with a blank card is an outage.
      const ok = res.status === 200 && /Alex Morgan/i.test(body) && /Save Contact/i.test(body);
      return { ok, detail: `status ${res.status}, name=${/Alex Morgan/i.test(body)}, saveBtn=${/Save Contact/i.test(body)}` };
    },
  },
  {
    name: "vCard download works (QR + Save Contact backbone)",
    run: async () => {
      const res = await get(`/api/card/${DEMO}/vcard`);
      const body = await res.text();
      const type = res.headers.get("content-type") || "";
      const ok = res.status === 200 && type.includes("vcard") && body.startsWith("BEGIN:VCARD") && /FN:/.test(body);
      return { ok, detail: `status ${res.status}, type=${type.split(";")[0]}, ${body.length} bytes` };
    },
  },
  {
    name: "Swift Links page renders",
    run: async () => {
      const res = await get(`/links/${DEMO}`);
      const ok = res.status === 200;
      return { ok, detail: `status ${res.status}` };
    },
  },
  {
    name: "pricing page renders",
    run: async () => {
      const res = await get("/pricing");
      const ok = res.status === 200;
      return { ok, detail: `status ${res.status}` };
    },
  },
  {
    name: "sign-in page reachable",
    run: async () => {
      const res = await get("/login");
      const ok = res.status === 200;
      return { ok, detail: `status ${res.status}` };
    },
  },
  {
    name: "error reporting endpoint accepting reports",
    run: async () => {
      // If this is broken we lose the one piece of monitoring that IS live.
      const res = await get("/api/client-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: "info", context: "healthcheck.probe", message: "uptime probe" }),
      });
      const ok = res.status >= 200 && res.status < 300;
      return { ok, detail: `status ${res.status}` };
    },
  },
];

const started = Date.now();
const results = [];
for (const c of CHECKS) {
  const t0 = Date.now();
  const r = await attempt(c.run);
  results.push({ name: c.name, ok: !!r?.ok, detail: r?.detail ?? "no response", ms: Date.now() - t0 });
}

const failed = results.filter((r) => !r.ok);
console.log(JSON.stringify({
  base: BASE,
  healthy: failed.length === 0,
  checked: results.length,
  failedCount: failed.length,
  totalMs: Date.now() - started,
  results,
}, null, 2));
