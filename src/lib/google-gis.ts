// ── Google Identity Services (GIS) loader — WEB ONLY ────────────────────────
// Loads https://accounts.google.com/gsi/client exactly once per page, no matter
// how many components ask for it, and resolves when window.google.accounts.id
// is available. Never import this in a native/Capacitor code path — GIS is the
// browser sign-in surface; native iOS keeps its own Google flow.
//
// Why a module-level singleton: React strict-mode double-mounts and multiple
// button instances would otherwise inject the <script> more than once and
// re-init GIS, which triggers duplicate One Tap prompts and duplicate callbacks.

const GIS_SRC = "https://accounts.google.com/gsi/client";

type GoogleIdConfig = {
  client_id: string;
  callback: (resp: { credential?: string }) => void;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
  use_fedcm_for_prompt?: boolean;
};

type GoogleId = {
  initialize: (config: GoogleIdConfig) => void;
  renderButton: (parent: HTMLElement, opts: Record<string, unknown>) => void;
  prompt: (listener?: (n: unknown) => void) => void;
  cancel: () => void;
  disableAutoSelect: () => void;
};

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

let loadPromise: Promise<GoogleId> | null = null;

export function loadGoogleIdentity(): Promise<GoogleId> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("GIS can only load in the browser"));
  }
  // Already available (script previously loaded).
  if (window.google?.accounts?.id) {
    return Promise.resolve(window.google.accounts.id);
  }
  // Load in flight or done — reuse the single promise.
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<GoogleId>((resolve, reject) => {
    const finish = () => {
      const id = window.google?.accounts?.id;
      if (id) resolve(id);
      else reject(new Error("Google Identity Services failed to initialize"));
    };

    // A script tag may already exist (e.g. re-entry after an earlier load).
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    if (existing) {
      if (window.google?.accounts?.id) return finish();
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Identity Services")), { once: true });
      return;
    }

    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.addEventListener("load", finish, { once: true });
    s.addEventListener("error", () => {
      loadPromise = null; // allow a retry on a later mount
      reject(new Error("Failed to load Google Identity Services"));
    }, { once: true });
    document.head.appendChild(s);
  });

  return loadPromise;
}
