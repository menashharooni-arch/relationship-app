const KEY = "kontact_vid";

// A stable per-device visitor id so analytics count UNIQUE VISITORS, not page
// loads. localStorage (not sessionStorage) is deliberate: it survives reloads,
// new tabs, and reopening the browser, so the same person viewing the same card
// keeps one id — the view API then dedups their repeat opens within 24h instead
// of logging each as a fresh visitor. (A return visit after 24h still records a
// new view, so repeat interest is tracked as its own row, distinguishable by the
// shared visitor_id.) Falls back to sessionStorage, then an in-memory id, when
// persistent storage is blocked (private mode) so tracking still degrades safely.
let memoryId = "";

export function getVisitorId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // localStorage unavailable (private mode / blocked cookies) — keep a
    // per-session id so at least same-tab reloads still dedup.
    try {
      let id = sessionStorage.getItem(KEY);
      if (!id) {
        id = crypto.randomUUID();
        sessionStorage.setItem(KEY, id);
      }
      return id;
    } catch {
      if (!memoryId) memoryId = crypto.randomUUID();
      return memoryId;
    }
  }
}

// ── Visitor share-state ──────────────────────────────────────────────────────
// Once a visitor shares their info with a card owner, every surface on that
// owner's pages (card, Swift Links, connect modal) must stop asking for it.
// We remember WHO they shared with and WHAT they shared, so forms can either
// hide themselves or pre-fill.
const SHARED_KEY = "swiftcard_shared";   // { [ownerSlug]: true } — kept for back-compat
const INFO_KEY = "swiftcard_visitor";    // { name, phone, email } — the visitor's own details
const SAVED_KEY = "swiftcard_saved";     // { [ownerSlug]: true } — has this visitor saved this card to contacts before

export type VisitorInfo = { name: string; phone: string; email: string };

export function hasSharedWith(owner: string | null | undefined): boolean {
  if (!owner || typeof window === "undefined") return false;
  try {
    return !!JSON.parse(localStorage.getItem(SHARED_KEY) ?? "{}")[owner];
  } catch {
    return false;
  }
}

export function markSharedWith(owner: string | null | undefined, info?: Partial<VisitorInfo>): void {
  if (typeof window === "undefined") return;
  try {
    if (owner) {
      const map = JSON.parse(localStorage.getItem(SHARED_KEY) ?? "{}");
      map[owner] = true;
      localStorage.setItem(SHARED_KEY, JSON.stringify(map));
    }
    if (info?.name?.trim() && info?.phone?.trim()) {
      localStorage.setItem(
        INFO_KEY,
        JSON.stringify({ name: info.name.trim(), phone: info.phone.trim(), email: (info.email ?? "").trim() })
      );
    }
  } catch { /* private mode */ }
  // Broadcast so any other share surface on the page (e.g. the social-link
  // intercept) updates live — once the visitor has shared, nothing re-asks.
  try { window.dispatchEvent(new CustomEvent("sc:shared", { detail: { owner } })); } catch { /* ignore */ }
}

// Has this visitor already saved this card to their contacts? Persisted the
// same way as hasSharedWith, so returning visitors see a confirmation instead
// of the plain "Save Contact" button again.
export function hasSavedContact(owner: string | null | undefined): boolean {
  if (!owner || typeof window === "undefined") return false;
  try {
    return !!JSON.parse(localStorage.getItem(SAVED_KEY) ?? "{}")[owner];
  } catch {
    return false;
  }
}

export function markSavedContact(owner: string | null | undefined): void {
  if (!owner || typeof window === "undefined") return;
  try {
    const map = JSON.parse(localStorage.getItem(SAVED_KEY) ?? "{}");
    map[owner] = true;
    localStorage.setItem(SAVED_KEY, JSON.stringify(map));
  } catch { /* private mode */ }
}

export function getVisitorInfo(): VisitorInfo | null {
  if (typeof window === "undefined") return null;
  try {
    const v = JSON.parse(localStorage.getItem(INFO_KEY) ?? "null");
    return v?.name && v?.phone ? { name: v.name, phone: v.phone, email: v.email ?? "" } : null;
  } catch {
    return null;
  }
}
