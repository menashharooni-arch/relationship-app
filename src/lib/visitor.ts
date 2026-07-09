const KEY = "kontact_vid";

export function getVisitorId(): string {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(KEY, id);
  }
  return id;
}

// ── Visitor share-state ──────────────────────────────────────────────────────
// Once a visitor shares their info with a card owner, every surface on that
// owner's pages (card, Swift Links, connect modal) must stop asking for it.
// We remember WHO they shared with and WHAT they shared, so forms can either
// hide themselves or pre-fill.
const SHARED_KEY = "swiftcard_shared";   // { [ownerSlug]: true } — kept for back-compat
const INFO_KEY = "swiftcard_visitor";    // { name, phone, email } — the visitor's own details

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

export function getVisitorInfo(): VisitorInfo | null {
  if (typeof window === "undefined") return null;
  try {
    const v = JSON.parse(localStorage.getItem(INFO_KEY) ?? "null");
    return v?.name && v?.phone ? { name: v.name, phone: v.phone, email: v.email ?? "" } : null;
  } catch {
    return null;
  }
}
