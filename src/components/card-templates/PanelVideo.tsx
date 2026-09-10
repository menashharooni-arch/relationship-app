import { getFinish } from "@/lib/card-finishes";
import type { TemplateStyle } from "@/lib/template-style";

// ── A card background video that actually plays ──────────────────────────────
//
// Uploading a video as your card's background has been possible since the
// panel-media control shipped, and it has never once played. The upload worked,
// the poster frame was captured, the style saved — and then every one of the
// six templates painted the POSTER as a CSS background and stopped there.
// CSS cannot play a video, and the comment in template-style.ts that promised
// "the live card page layers the real <video> over this same surface" described
// a component that did not exist. Every card with a video background has been
// showing a still frame, everywhere, since the feature launched.
//
// WHY NEGATIVE z-index, AND WHY THE PANEL MUST ISOLATE
//
// The obvious placement — `absolute inset-0` inside the panel — hides the card's
// own text, because an absolutely positioned element paints ABOVE its in-flow
// siblings no matter what order they are written in. The existing dot-texture
// overlays get away with it only because they are transparent.
//
// A child at `z-index: -1` paints above its parent's own background and BELOW
// the parent's in-flow content, which is exactly the slot a background video
// wants — and it needs no restructuring of any template's markup. The one
// condition is that the panel must establish a stacking context, or the -1
// escapes upward and disappears behind an ancestor. `isolation: isolate` on the
// panel does that without changing anything else about how it renders.
//
// THE ATTRIBUTES ARE NOT OPTIONAL
//
// muted + playsInline + autoPlay is the exact combination iOS Safari and the
// shell's WKWebView require before they will start a video without a tap. Drop
// muted and it silently never starts; drop playsInline and iOS takes it
// fullscreen the moment it plays. `loop` is the whole point.
//
// The poster stays on the CSS background underneath as well as on the element,
// so a card whose video is still loading, blocked, or 404 shows the still frame
// it always showed rather than a black rectangle.

export default function PanelVideo({ style }: { style: TemplateStyle }) {
  if (style.panelMediaType !== "video" || !style.panelMedia) return null;

  // The dim and the finish live in the panel's CSS background, which paints
  // UNDER this layer — so they have to be re-applied on top of the video or a
  // dimmed video would come out undimmed and a brushed-metal card would lose
  // its sheen. Same order composePanelBackground uses: finish first (on top),
  // then the dim.
  const dim = Math.min(0.85, Math.max(0, style.panelDim ?? 0));
  const overlay = [...getFinish(style.finish).layers];
  if (dim > 0) overlay.push(`linear-gradient(rgba(0,0,0,${dim}), rgba(0,0,0,${dim}))`);

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{ zIndex: -1 }}
    >
      <video
        src={style.panelMedia}
        poster={style.panelMediaPoster}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className="absolute inset-0 w-full h-full object-cover"
      />
      {overlay.length > 0 && (
        <div className="absolute inset-0" style={{ background: overlay.join(", ") }} />
      )}
    </div>
  );
}
