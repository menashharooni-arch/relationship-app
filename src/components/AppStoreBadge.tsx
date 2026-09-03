import { APP_STORE_URL } from "@/lib/app-store";
import NativeHidden from "@/components/NativeHidden";

// ── The one "Download on the App Store" badge ────────────────────────────────
//
// Every download surface on the marketing site and in the post-signup flow
// renders THIS. It used to be copy-pasted markup in the homepage hero and the
// footer, which is how two badges on one page end up different sizes with
// different hover states — and how a change like the shine below lands on one
// and not the other.
//
// Self-activating, same contract as every other APP_STORE_URL consumer: renders
// nothing until the env var is set, so it is safe to place anywhere before a
// listing exists (see lib/app-store.ts).
//
// NOT a client component — it has no interactivity, so server-rendered pages
// (homepage, footer) keep shipping zero JS for it. The shine is pure CSS.

type Tone = "black" | "glass";
type Size = "sm" | "md";

const SIZES: Record<Size, { pad: string; glyph: string; top: string; main: string; gap: string; radius: string }> = {
  // Nav bar: has to sit inside a 64px-tall bar next to a primary CTA without
  // crowding it, so it is one step down from the hero's.
  sm: { pad: "px-3 py-1.5", glyph: "w-[17px] h-[17px]", top: "text-[9px]", main: "text-[12.5px]", gap: "gap-2", radius: "rounded-[10px]" },
  md: { pad: "px-3.5 py-2", glyph: "w-[22px] h-[22px]", top: "text-[10px]", main: "text-[14px]", gap: "gap-2.5", radius: "rounded-xl" },
};

// Black on light surfaces, glass on dark ones — matching what the hero and the
// footer each already used.
const TONES: Record<Tone, { shell: string; top: string }> = {
  black: { shell: "bg-slate-900 hover:bg-slate-800", top: "text-white/60" },
  glass: { shell: "border border-white/15 bg-white/[0.06] hover:bg-white/10", top: "text-white/50" },
};

export function AppleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`${className ?? ""} shrink-0`} fill="#fff">
      <path d="M16.365 1.43c0 1.14-.417 2.2-1.11 2.98-.75.84-1.98 1.49-3.02 1.4-.13-1.09.42-2.24 1.09-2.98.76-.85 2.07-1.47 3.04-1.4zM20.5 17.02c-.55 1.27-.82 1.84-1.53 2.96-.99 1.57-2.39 3.52-4.12 3.53-1.54.01-1.93-1-4.02-.99-2.09.01-2.52 1.01-4.06.99-1.73-.02-3.06-1.78-4.05-3.35-2.77-4.38-3.06-9.52-1.35-12.25 1.21-1.94 3.13-3.08 4.94-3.08 1.84 0 3 1.01 4.52 1.01 1.48 0 2.38-1.01 4.51-1.01 1.61 0 3.32.88 4.54 2.39-3.99 2.19-3.34 7.88.1 9.25z" />
    </svg>
  );
}

export default function AppStoreBadge({
  tone = "black",
  size = "md",
  className = "",
}: {
  tone?: Tone;
  size?: Size;
  className?: string;
}) {
  if (!APP_STORE_URL) return null;
  const s = SIZES[size];
  const t = TONES[tone];

  return (
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Download SwiftCard on the App Store"
      // overflow-hidden clips the shine to the pill; relative is what it anchors
      // to. Both are load-bearing — without them the sweep runs across whatever
      // sits next to the badge.
      className={`relative overflow-hidden inline-flex items-center ${s.gap} ${s.radius} ${s.pad} ${t.shell} transition-colors ${className}`}
    >
      <AppleGlyph className={s.glyph} />
      <span className="leading-tight">
        <span className={`block ${t.top} ${s.top}`}>Download on the</span>
        <span className={`block text-white font-semibold ${s.main} tracking-tight`}>App&nbsp;Store</span>
      </span>
      <span className="rd-appstore-shine" aria-hidden="true" />
    </a>
  );
}

/**
 * The "you just made a card — now get the app" block.
 *
 * Placed at the ONE moment someone has proved they want this product and has
 * nothing else to do: the "Your card is live!" screen. There are two of those
 * screens (the /welcome page after signup, and step 5 of the card wizard for an
 * already-signed-in user), and they must not drift apart, so both render this.
 *
 * It sits directly under the notifications switch on purpose. On iPhone those
 * two are the same story — web push needs the site added to the home screen,
 * while the app just asks — so the switch above is the strongest possible
 * argument for the badge below. It goes BEFORE the continue button and never
 * replaces it: the card is created either way, and this must not read as a step
 * standing between the user and their dashboard.
 *
 * NativeHidden because inside the app itself this is nonsense.
 */
export function GetTheAppCard({ className = "" }: { className?: string }) {
  if (!APP_STORE_URL) return null;
  return (
    <NativeHidden>
      <div className={`rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-center ${className}`}>
        <p className="text-sm font-semibold text-gray-100">Get SwiftCard on iPhone</p>
        <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-gray-400">
          Share your card with a tap, keep it in Apple Wallet, and see who viewed it — right from your phone.
        </p>
        <div className="mt-3.5 flex justify-center">
          <AppStoreBadge tone="glass" size="md" />
        </div>
      </div>
    </NativeHidden>
  );
}

/**
 * Icon-only variant for the mobile nav bar.
 *
 * Measured, not guessed: at 390px the bar has ~222px to the right of the logo,
 * and the primary CTA plus the menu trigger plus their gaps already take 174 of
 * it. A badge carrying any words needs ~85px and blows the row apart — it was
 * built that way first and overflowed at every phone width up to 430px. So this
 * is a 32px square, which is what actually fits.
 *
 * A bare Apple mark can read as "Sign in with Apple", but that ambiguity lives
 * in auth contexts; in a marketing nav beside "Get started" it reads as the iOS
 * app, and an arrow or a second glyph inside 32px only makes it muddy. The
 * disambiguation is the title/aria-label, plus the full "Download on the App
 * Store" wording in the menu sheet one tap away and again in the hero — so the
 * words are never actually lost, only deferred where they cannot fit.
 */
export function AppStoreBadgeCompact({ className = "" }: { className?: string }) {
  if (!APP_STORE_URL) return null;
  return (
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Download SwiftCard on the App Store"
      title="Download SwiftCard on the App Store"
      className={`relative overflow-hidden h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-white/15 bg-white/[0.06] transition-colors hover:bg-white/10 ${className}`}
    >
      <AppleGlyph className="w-[15px] h-[15px]" />
      <span className="rd-appstore-shine" aria-hidden="true" />
    </a>
  );
}
