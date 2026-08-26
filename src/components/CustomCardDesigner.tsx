"use client";

// Pro custom-card designer.
//
// ONE screen, not two. An earlier version opened on a "choose a starting point"
// picker and only then showed the editor, which read as a broken state: the
// page's own live preview was still rendering the legacy scattered layout while
// the designer showed a grid of thumbnails, so the card looked like it had
// exploded. The layout now always exists, the card is always right, and the
// starting points are a strip inside the editor you can hover to try.
//
// On desktop this is a WORKSPACE: the card is pinned on the left at the size it
// will actually publish at, every control sits in a column beside it, and the
// page's own preview column stands down (see designerIsCanvas in the editor and
// the wizard) so there is exactly one card on screen instead of two.
//
// The preview is the REAL renderer (CustomBlockCard) inside CardScaler at the
// same 460 design width the public card page uses — the previous designer drew
// its own canvas at whatever width the column happened to be while element sizes
// were absolute px, so the same name filled 35.5% of the card while you designed
// it and 24.7% once it published.
//
// Every action is forgiving: toggle a block, move it between zones, reorder it,
// or change its emphasis. No coordinates, no font sizes, and undo on all of it.

import { useEffect, useMemo, useRef, useState } from "react";
import type { CardData, CardEmphasis, CardSkeleton, CardZone, CustomBlock, CustomLayout } from "@/components/card-templates/types";
import { CustomBlockCard, FaceCard } from "@/components/card-templates/CustomCard";
import CardScaler from "@/components/CardScaler";
import {
  ADDABLE, LAYOUT_PRESETS, MAX_VISIBLE_BLOCKS, SKELETONS, blockHasValue, blockLabel,
  blockLoad, buildPreset, canChangeZone, hasBlocks, isFull, newBlockId, zoneFor, zoneLabels,
} from "@/lib/custom-layout";

const FONTS = [
  { label: "Sans", value: "var(--font-geist-sans), system-ui, sans-serif" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Mono", value: "'Courier New', ui-monospace, monospace" },
  { label: "Rounded", value: "'Trebuchet MS', system-ui, sans-serif" },
];

// Coordinated grounds. Each carries its own text + accent so one tap restyles
// the whole card correctly, instead of leaving six colours to fix by hand.
const GROUNDS = [
  { label: "Navy",     background: "#2c3a52", textColor: "#ffffff", accentColor: "#ffffff" },
  { label: "Midnight", background: "#141b26", textColor: "#ffffff", accentColor: "#7fa6f0" },
  { label: "Indigo",   background: "#312e81", textColor: "#ffffff", accentColor: "#c7d2fe" },
  { label: "Forest",   background: "#16352c", textColor: "#ffffff", accentColor: "#8fd3b6" },
  { label: "Oxblood",  background: "#33191d", textColor: "#f6ece9", accentColor: "#e0a3a0" },
  { label: "Graphite", background: "#1f2430", textColor: "#ffffff", accentColor: "#9fb2cc" },
  { label: "Ivory",    background: "#faf9f6", textColor: "#1c1612", accentColor: "#b08d57" },
  { label: "Bone",     background: "#f4f2ed", textColor: "#141b26", accentColor: "#2c3a52" },
];

const EMPHASIS: { key: CardEmphasis; label: string }[] = [
  { key: "hero", label: "Big" },
  { key: "normal", label: "Normal" },
  { key: "quiet", label: "Small" },
];

/**
 * A look, drawn as a diagram rather than a name.
 *
 * A 96px screenshot of a real card is unreadable mush, and a text chip that says
 * "Meridian" tells you nothing — so this draws the SHAPE (which side the panel
 * is on, how big the name runs, where the QR sits) in the look's own colours.
 * You can tell the eight apart at a glance, which is the whole job; hovering
 * then puts the real thing on the real card.
 */
function LookThumb({ layout }: { layout: CustomLayout }) {
  const stacked = layout.skeleton === "stacked";
  const mirror = layout.skeleton === "mirror";
  const hasPanel = (layout.blocks ?? []).some((b) => b.on && zoneFor(b) === "left");
  const ink = layout.textColor;
  const bar = (w: string, h: number, o: number, color = ink) => (
    <span style={{ display: "block", width: w, height: h, borderRadius: 1, background: color, opacity: o }} />
  );
  return (
    <span
      aria-hidden
      style={{
        display: "flex",
        flexDirection: stacked ? "column" : mirror ? "row-reverse" : "row",
        width: "100%", aspectRatio: "1.75 / 1", borderRadius: 5, overflow: "hidden",
        background: layout.background, fontFamily: layout.fontFamily,
      }}
    >
      {hasPanel && (
        <span
          style={{
            flex: stacked ? "0 0 30%" : "0 0 32%",
            background: layout.panelBackground ?? layout.background,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: layout.panelBackground ? "none" : `inset -1px 0 0 ${ink}22`,
          }}
        >
          {/* Sized off the SHORT axis of the band. Sized by width, a stacked
              band's mark came out taller than the band that holds it. */}
          <span style={{
            display: "block", aspectRatio: "1 / 1", borderRadius: 2,
            ...(stacked ? { height: "52%" } : { width: "42%" }),
            background: layout.panelTextColor ?? ink, opacity: 0.5,
          }} />
        </span>
      )}
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "13%  11%" }}>
        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {bar("72%", 4, 0.95)}
          {bar("48%", 2, 0.5, layout.accentColor || ink)}
        </span>
        <span style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 4 }}>
          <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
            {bar("86%", 2, 0.42)}
            {bar("64%", 2, 0.42)}
          </span>
          <span style={{
            display: "block", width: "22%", aspectRatio: "1 / 1", borderRadius: 1,
            background: ink, opacity: 0.28,
          }} />
        </span>
      </span>
    </span>
  );
}

export default function CustomCardDesigner({
  layout,
  data,
  onChange,
  // Copying a layout costs an AI call, so /api/scan-design requires a
  // session AND a paid plan. The wizard shows this whole designer to guests and
  // to Free first-card users as a preview (designUnlocked), which would put a
  // button in front of people the route answers 401/403 — they'd retake the
  // photo and fail again. So the caller says whether scanning is actually
  // available and the button teaches rather than breaks.
  canScan = true,
}: {
  layout: CustomLayout;
  data: CardData;
  onChange: (layout: CustomLayout) => void;
  canScan?: boolean;
}) {
  const history = useRef<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanNote, setScanNote] = useState<string | null>(null);
  /** A generated exact-copy awaiting the owner's verdict. Holds the source
   *  upload too, so "Try again" and "make it editable instead" never ask them
   *  to find the same file twice. */
  const [transfer, setTransfer] = useState<{ src: string; b64: string; url: string; checklist: string[] } | null>(null);
  const [hoverLook, setHoverLook] = useState<string | null>(null);

  // A layout without blocks is a card saved by the old designer (or the legacy
  // default the page still seeds). Upgrade it once, here, so the page's preview
  // and this editor can never disagree about what the card looks like.
  const upgraded = useRef(false);
  useEffect(() => {
    if (hasBlocks(layout) || upgraded.current) return;
    upgraded.current = true;
    const base = buildPreset("ink");
    onChange({ ...base, ...layout, blocks: base.blocks, elements: [] });
  }, [layout, onChange]);

  const blocks = useMemo(() => layout.blocks ?? [], [layout.blocks]);
  const zones = zoneLabels(layout.skeleton);
  const full = isFull(blocks);

  // Built once, not per render: the thumbnails read colours off these and the
  // hover preview hands one straight to the renderer.
  const looks = useMemo(
    () => Object.entries(LAYOUT_PRESETS).map(([key, p]) => ({ key, ...p, preview: p.build() })),
    [],
  );

  function commit(next: CustomLayout) {
    history.current.push(JSON.stringify(layout));
    if (history.current.length > 50) history.current.shift();
    setCanUndo(true);
    onChange(next);
  }
  function undo() {
    const prev = history.current.pop();
    if (!prev) return;
    setCanUndo(history.current.length > 0);
    onChange(JSON.parse(prev) as CustomLayout);
  }
  const setBlocks = (next: CustomBlock[]) => commit({ ...layout, blocks: next });
  const patch = (id: string, p: Partial<CustomBlock>) =>
    setBlocks(blocks.map((b) => (b.id === id ? { ...b, ...p } : b)));

  function move(id: string, dir: -1 | 1) {
    const i = blocks.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    setBlocks(next);
  }

  /** Decode an upload and re-encode it at ≤1400px. A phone photo is 4-6MB and
   *  carries no more information about a card than 1400px does — slow to
   *  upload and billed by the token. Null = the browser can't decode the file
   *  (an iPhone library HEIC, a PDF picked through "All files"). */
  async function toJpeg(file: File): Promise<{ b64: string; dataUrl: string } | null> {
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("read"));
        reader.readAsDataURL(file);
      });
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error("decode"));
        i.src = dataUrl;
      });
      const scale = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      const jpeg = canvas.toDataURL("image/jpeg", 0.82);
      return { b64: jpeg.split(",")[1] ?? "", dataUrl: jpeg };
    } catch {
      return null;
    }
  }

  /** The EXACT copy: the model rebuilds the uploaded design carrying the
   *  owner's own details, and the owner approves a preview before anything
   *  touches the card. The upload's b64 is kept so "Try again" doesn't make
   *  them find the file twice. */
  async function transferDesign(source: { b64: string; dataUrl: string }) {
    setScanError(null);
    setScanNote(null);
    setScanning(true);
    // Nothing downstream is guaranteed to answer: without a deadline the button
    // spins until the platform gives up on the function, which is a long time
    // to watch a spinner. The pipeline can run several generation+verify
    // passes (full rebuild retries, then the hybrid artwork engine), so the
    // deadline tracks the route's own 180s budget — cutting off at 55s was
    // itself the "it errored" the owner reported (2026-08-26): the server was
    // still working on a good copy when the client hung up.
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 150_000);
    try {
      const res = await fetch("/api/design-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: source.b64,
          mediaType: "image/jpeg",
          identity: {
            name: data.name, title: data.title, company: data.company,
            phone: data.phone, email: data.email, website: data.website, address: data.address,
          },
          photoUrl: data.photoUrl ?? undefined,
          logoUrl: data.logoUrl ?? undefined,
        }),
        signal: abort.signal,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setScanError(
          res.status === 401 ? "Sign in first — copying a card design needs an account."
          : res.status === 403 ? "Copying a card design is a Pro feature."
          : res.status === 429 ? "Too many copies just now — try again in a minute."
          : (j as { error?: string }).error === "no_ai" ? "Copying a design is unavailable right now."
          : "Couldn't rebuild that design. Try again, or try a cleaner image.",
        );
        return;
      }
      const { url, checklist } = (await res.json()) as { url?: string; checklist?: string[] };
      if (!url) {
        setScanError("Couldn't rebuild that design. Try again, or try a cleaner image.");
        return;
      }
      setTransfer({ src: source.dataUrl, b64: source.b64, url, checklist: checklist ?? [] });
    } catch (e) {
      setScanError(
        (e as { name?: string })?.name === "AbortError"
          ? "That took too long. Try again in a moment."
          : "That didn't work. Try another image.",
      );
    } finally {
      clearTimeout(timer);
      setScanning(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  /** The old path — copy the LAYOUT into editable blocks, never any contents.
   *  Offered from the preview as "make it editable instead". */
  async function scanLayoutOnly(b64: string) {
    setScanError(null);
    setScanNote(null);
    setScanning(true);
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 45_000);
    try {
      const res = await fetch("/api/scan-design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: b64, mediaType: "image/jpeg" }),
        signal: abort.signal,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setScanError(
          res.status === 401 ? "Sign in first — copying a card layout needs an account."
          : res.status === 403 ? "Copying a card layout is a Pro feature."
          : res.status === 429 ? "Too many copies just now — try again in a minute."
          : res.status === 422 ? "Couldn't read that image. Try a straight-on shot in good light."
          : (j as { error?: string }).error === "no_ai" ? "Copying a layout is unavailable right now."
          : "That didn't work. Try another image.",
        );
        return;
      }
      const { layout: scanned } = (await res.json()) as { layout?: CustomLayout };
      if (!scanned?.blocks?.length) {
        setScanError("Couldn't read that image. Try a straight-on shot in good light.");
        return;
      }
      // Layout-only replaces the face image too: the owner just chose blocks.
      commit({ ...scanned, faceImage: undefined });
      setScanNote("Layout copied as editable blocks. Your own details are untouched — change anything below, or Undo.");
    } catch (e) {
      setScanError(
        (e as { name?: string })?.name === "AbortError"
          ? "That took too long. Try again in a moment."
          : "That didn't work. Try another image.",
      );
    } finally {
      clearTimeout(timer);
      setScanning(false);
    }
  }

  /** Entry point from the file input. */
  async function scanPrintedCard(file: File) {
    setScanError(null);
    const prepared = await toJpeg(file);
    if (!prepared) {
      setScanError("We couldn't open that file. Pick a JPG or PNG, or take a photo.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    await transferDesign(prepared);
  }

  // Hovering a look shows it on the card without committing, so you can try all
  // eight without a single undo.
  const shown = useMemo(
    () => looks.find((l) => l.key === hoverLook)?.preview ?? layout,
    [looks, hoverLook, layout],
  );
  const previewData: CardData = useMemo(
    () => ({ ...data, customization: { ...(data.customization ?? {}), customLayout: shown } }),
    [data, shown],
  );

  // Tapping the card selects that block — the card is a control, not just an
  // output. Delegation reads the data-cb the renderer emits, so CustomCard stays
  // handler-free and therefore still server-renderable.
  function onCardPointerDown(e: React.PointerEvent) {
    const hit = (e.target as HTMLElement).closest?.("[data-cb]");
    const id = hit?.getAttribute("data-cb");
    if (id) setOpenId((cur) => (cur === id ? null : id));
  }

  const card = "bg-gray-900 border border-gray-800 rounded-xl";
  const head = "text-[11px] font-semibold uppercase tracking-wide text-gray-400";
  const row = "text-[10.5px] text-gray-500 w-[52px] shrink-0 pt-1.5";
  const chip = "text-[12px] px-3 py-1.5 rounded-lg border transition-colors";
  const chipOff = "bg-gray-800 border-gray-600 text-gray-100 hover:text-white hover:border-gray-400";
  const chipOn = "bg-blue-600 border-blue-600 text-white";

  if (!hasBlocks(layout)) {
    return <div className="h-24 rounded-xl bg-gray-900 border border-gray-800 animate-pulse" aria-label="Preparing your design" />;
  }

  return (
    // Three children, so the phone can interleave them and the desktop cannot.
    //
    // On a phone this is a flex column ordered Looks -> card -> Style: you pick
    // a Look, see it on the card immediately below, and only then work down into
    // Style. Putting the card first (as it was) meant choosing a Look scrolled
    // its result off the top of the screen.
    //
    // At lg it becomes the same two-column grid as before, with every child
    // placed EXPLICITLY. Auto-placement would flow the third child back under
    // the canvas; the row/column starts are what keep Looks and Style stacked in
    // the right-hand track with the card spanning both rows beside them.
    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-x-5 lg:gap-y-3 lg:items-start">
      {/* Looks — hover any one to see it on your card, click to keep it. */}
      <div className={`${card} p-3 space-y-2.5 order-1 lg:col-start-2 lg:row-start-1`}>
        <div className="flex items-baseline justify-between gap-2">
          <p className={head}>Looks</p>
          <p className="text-[10.5px] text-gray-600">hover to preview · click to use</p>
        </div>
        {/* THE headline feature of the custom designer (owner order 2026-08-26:
            "the best feature we have — make people notice it"). Moved to the
            TOP of Looks and dressed as the hero: animated gradient frame, soft
            glow, shine sweep. Behavior is byte-for-byte the old box — same
            click, same gating, same copy, same file input below. Reduced
            motion turns the animation off; the frame still reads as special. */}
        <style>{`
          @keyframes sc-magic-border { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
          @keyframes sc-magic-glow { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.75; } }
          @keyframes sc-magic-shine { 0% { transform: translateX(-160%) skewX(-18deg); } 60%, 100% { transform: translateX(340%) skewX(-18deg); } }
          .sc-magic-frame { background: linear-gradient(110deg, #2563eb, #7c3aed, #06b6d4, #2563eb); background-size: 300% 300%; animation: sc-magic-border 5s ease-in-out infinite; }
          .sc-magic-halo { animation: sc-magic-glow 2.8s ease-in-out infinite; }
          .sc-magic-shine { animation: sc-magic-shine 4.5s ease-in-out infinite; }
          @media (prefers-reduced-motion: reduce) { .sc-magic-frame, .sc-magic-halo, .sc-magic-shine { animation: none; } }
        `}</style>
        <div className="relative">
          {canScan && !scanning && (
            <div className="sc-magic-halo absolute -inset-1 rounded-2xl bg-gradient-to-r from-blue-600/40 via-violet-600/40 to-cyan-500/40 blur-md pointer-events-none" aria-hidden="true" />
          )}
          <div className={`relative rounded-xl p-[1.5px] ${canScan ? "sc-magic-frame" : "bg-gray-800"}`}>
            <button
              type="button"
              onClick={() => { if (canScan) fileRef.current?.click(); }}
              disabled={scanning || !canScan}
              className={`relative overflow-hidden w-full rounded-[10.5px] px-3.5 py-3.5 text-left transition-colors ${
                canScan ? "bg-gray-950 hover:bg-gray-900 disabled:opacity-70" : "bg-gray-950/90 cursor-default"
              }`}
            >
              {canScan && !scanning && (
                <span className="sc-magic-shine pointer-events-none absolute top-0 bottom-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" aria-hidden="true" />
              )}
              <span className="flex items-center gap-3">
                <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${canScan ? "bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-[0_0_14px_rgba(99,102,241,0.45)]" : "bg-gray-800 text-gray-500"}`}>
                  {scanning ? (
                    <span className="block w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : (
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.2V5.6A2.6 2.6 0 015.6 3h2.6M15.8 3h2.6A2.6 2.6 0 0121 5.6v2.6M21 15.8v2.6a2.6 2.6 0 01-2.6 2.6h-2.6M8.2 21H5.6A2.6 2.6 0 013 18.4v-2.6M7 12h10" />
                    </svg>
                  )}
                </span>
                <span className="min-w-0">
                  <span className={`block text-[13.5px] font-semibold ${canScan ? "text-white" : "text-gray-400"}`}>
                    {scanning ? "Rebuilding it with your details…" : "Copy a card or template you like"}
                    {canScan && !scanning && (
                      <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 text-white align-middle tracking-wide">✨ MAGIC</span>
                    )}
                    {!canScan && (
                      <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-600 text-white align-middle">PRO</span>
                    )}
                  </span>
                  <span className="block text-[11px] text-gray-400 leading-snug mt-0.5">
                    {canScan
                      ? "Upload a card design you like. We rebuild it exactly — same colors, fonts and layout — with YOUR details on it. You approve a preview before anything changes."
                      : "On Pro, upload a card design you like and we'll rebuild it exactly, with your details on it."}
                  </span>
                </span>
              </span>
            </button>
          </div>
        </div>
        {/* Capped. The controls column has no width of its own below lg, so
            on a half-screen desktop window (roughly 936-1023px, where the
            max-w-4xl page has saturated but the two-column layout has not
            kicked in) each of these diagrams rendered 212x143px — a wall of
            eight cards above the one card they are miniatures of. */}
        <div className="grid grid-cols-4 gap-2 max-w-[420px] lg:max-w-none">
          {looks.map((l) => (
            <button
              key={l.key}
              type="button"
              title={l.blurb}
              onMouseEnter={() => setHoverLook(l.key)}
              onMouseLeave={() => setHoverLook((cur) => (cur === l.key ? null : cur))}
              onFocus={() => setHoverLook(l.key)}
              onBlur={() => setHoverLook((cur) => (cur === l.key ? null : cur))}
              onClick={() => { setHoverLook(null); commit(l.build()); }}
              className={`rounded-lg p-1 transition-all ${
                hoverLook === l.key ? "ring-2 ring-blue-500 scale-[1.03]" : "ring-1 ring-gray-800 hover:ring-gray-600"
              }`}
            >
              <LookThumb layout={l.preview} />
              <span className="block text-[10px] text-gray-400 mt-1 truncate">{l.label}</span>
            </button>
          ))}
        </div>

        {/* NO `capture` attribute. With capture="environment" a phone opens
            straight into the camera, which makes the whole "or a template you
            found online" half of this feature unreachable — you cannot
            photograph an image that is already in your camera roll. Without it
            the OS offers camera AND library, so both routes work. */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void scanPrintedCard(f); }}
        />
        {scanError && <p className="text-[11px] text-amber-400">{scanError}</p>}
        {scanNote && <p className="text-[11px] text-emerald-400">{scanNote}</p>}

        {/* Exact design active: the card is the approved image, so the block
            controls below are dormant — say so where the owner is looking,
            with the way out right next to the statement. */}
        {layout.faceImage && (
          <div className="rounded-lg border border-blue-500/40 bg-blue-950/30 px-3 py-2.5 flex items-center gap-3">
            <p className="text-[11px] text-blue-200 leading-snug flex-1">
              Exact design is on — your card shows the approved image. Looks and Style below won&apos;t change it.
            </p>
            <button
              type="button"
              onClick={() => commit({ ...layout, faceImage: undefined })}
              className="text-[11px] font-semibold text-white bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg px-2.5 py-1.5 shrink-0"
            >
              Remove
            </button>
          </div>
        )}

        {/* ── The approval gate. An image model fumbles small text often enough
               that nothing may auto-apply: the owner compares the original and
               the rebuild side by side, walks the checklist, and only their
               tap writes the card. ── */}
        {transfer && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Approve your rebuilt card design">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-5 space-y-4">
              <p className="text-sm font-semibold text-white">Your card, in that design — check it before it goes on</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10.5px] text-gray-500 mb-1.5">The design you uploaded</p>
                  {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
                  <img src={transfer.src} alt="The design you uploaded" className="w-full rounded-lg border border-gray-800" />
                </div>
                <div>
                  <p className="text-[10.5px] text-gray-500 mb-1.5">Rebuilt with your details</p>
                  {/* eslint-disable-next-line @next/next/no-img-element -- our storage URL */}
                  <img src={transfer.url} alt="Rebuilt with your details" className="w-full rounded-lg border border-blue-500/50" />
                </div>
              </div>
              {transfer.checklist.length > 0 && (
                <div className="rounded-lg bg-gray-950 border border-gray-800 px-3 py-2.5">
                  <p className="text-[11px] font-semibold text-gray-300 mb-1">Look closely — AI rebuilds can misspell:</p>
                  <ul className="space-y-0.5">
                    {transfer.checklist.map((item) => (
                      <li key={item} className="text-[11px] text-gray-400 flex gap-1.5">
                        <span className="text-blue-400 shrink-0">✓</span>{item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    commit({ ...layout, faceImage: transfer.url });
                    setTransfer(null);
                    setScanNote("Exact design applied. Your live QR sits bottom-right; remove the design any time.");
                  }}
                  className="text-[12.5px] font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg px-4 py-2"
                >
                  Use this design
                </button>
                <button
                  type="button"
                  disabled={scanning}
                  onClick={() => { const t = transfer; setTransfer(null); if (t) void transferDesign({ b64: t.b64, dataUrl: t.src }); }}
                  className="text-[12.5px] font-semibold text-gray-200 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 disabled:opacity-60"
                >
                  Try again
                </button>
                <button
                  type="button"
                  disabled={scanning}
                  onClick={() => { const t = transfer; setTransfer(null); if (t) void scanLayoutOnly(t.b64); }}
                  className="text-[12px] text-gray-400 hover:text-gray-200 px-2 py-2"
                >
                  Make it editable blocks instead
                </button>
                <button
                  type="button"
                  onClick={() => setTransfer(null)}
                  className="text-[12px] text-gray-400 hover:text-gray-200 px-2 py-2 ml-auto"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── The canvas. Pinned on desktop: it stays in view while you work
             down the controls beside it. Capped and centred so the caption sits
             under the CARD rather than at the far edge of the track.
             row-span-2 gives the sticky box a containing block tall enough to
             travel in — a single-row area would pin it in place. ── */}
      <div className="order-2 w-full max-w-[560px] mx-auto lg:col-start-1 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-6">
        <div className="rounded-2xl border border-gray-800 bg-[radial-gradient(120%_90%_at_50%_0%,#141a26_0%,#0b0f17_70%)] p-4 sm:p-6">
          <div onPointerDown={onCardPointerDown} className="cursor-pointer">
            <CardScaler>
              {/* An approved exact design IS the card — show it. This canvas
                  rendered CustomBlockCard unconditionally, so pressing "Use
                  this design" committed the face image and the preview showed
                  ... the same block layout as before. To the owner the button
                  did nothing (report 2026-08-26); the design only appeared on
                  the live card page. The live renderer (CustomCard) makes the
                  same face-first choice. */}
              {shown.faceImage ? <FaceCard data={previewData} src={shown.faceImage} /> : <CustomBlockCard data={previewData} placeholder />}
            </CardScaler>
          </div>
        </div>
        <p className="text-[11px] text-gray-500 mt-2 min-w-0 truncate">
          {hoverLook
            ? `${looks.find((l) => l.key === hoverLook)?.label} — click to use it`
            : "Tap anything on the card to style it."}
        </p>
      </div>

      {/* ── The rest of the controls ── */}
      <div className="space-y-3 order-3 lg:col-start-2 lg:row-start-2">
        {/* Style — colour, type and arrangement in one place, one row each, so
            it reads as a single decision instead of three stacked boxes. */}
        <div className={`${card} p-3 space-y-2.5`}>
          {/* Undo lives here rather than under the card. It reverses every
              change — a Look, a copied layout, a colour, a moved block — so it
              belongs with the controls that make them, and on a phone that puts
              it within thumb's reach of the thing you just regretted instead of
              a scroll back up past the preview. */}
          <div className="flex items-center justify-between gap-2">
            <p className={head}>Style</p>
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              className="text-[11px] px-2.5 py-1 rounded-lg border border-gray-700 text-gray-300 disabled:opacity-40 hover:border-gray-500 shrink-0"
            >
              ↶ Undo
            </button>
          </div>

          <div className="flex gap-2">
            <span className={row}>Colour</span>
            <div className="flex flex-wrap gap-1.5 min-w-0">
              {GROUNDS.map((g) => (
                <button
                  key={g.label}
                  type="button"
                  title={g.label}
                  aria-label={g.label}
                  onClick={() => commit({ ...layout, background: g.background, textColor: g.textColor, accentColor: g.accentColor, panelBackground: undefined, panelTextColor: undefined })}
                  className="w-6 h-6 rounded-lg transition-transform hover:scale-110"
                  style={{
                    background: g.background,
                    boxShadow: layout.background === g.background
                      ? "0 0 0 2px #3b82f6"
                      : "inset 0 0 0 1px rgba(148,163,184,.35)",
                  }}
                />
              ))}
              <label className="flex items-center gap-1 text-[10px] text-gray-500">
                <input
                  type="color"
                  aria-label="Custom background colour"
                  value={/^#[0-9a-f]{6}$/i.test(layout.background) ? layout.background : "#2c3a52"}
                  onChange={(e) => commit({ ...layout, background: e.target.value })}
                  className="w-6 h-6 rounded bg-transparent border border-gray-700"
                />
                custom
              </label>
            </div>
          </div>

          <div className="flex gap-2">
            <span className={row}>Type</span>
            <div className="flex flex-wrap gap-1.5 min-w-0">
              {FONTS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => commit({ ...layout, fontFamily: f.value })}
                  className={`${chip} ${layout.fontFamily === f.value ? chipOn : chipOff}`}
                  style={{ fontFamily: f.value }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <span className={row}>Panel</span>
            <div className="flex flex-wrap gap-1.5 min-w-0">
              {SKELETONS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => commit({ ...layout, skeleton: s.key as CardSkeleton })}
                  className={`${chip} ${(layout.skeleton ?? "split") === s.key ? chipOn : chipOff}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* What's on the card */}
        <div className={`${card} overflow-hidden`}>
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-800">
            <p className={head}>What&apos;s on your card</p>
            {/* Counted in ROWS, like the cap itself — three socials share one,
                so showing raw blocks would have said "full" with room left. */}
            <p className={`text-[11px] ${full ? "text-amber-400" : "text-gray-600"}`}>
              {blockLoad(blocks)} of {MAX_VISIBLE_BLOCKS}
            </p>
          </div>
          {full && (
            <p className="px-3 pt-2 text-[11px] text-amber-400/90">
              Your card is full — turn something off to add something else.
            </p>
          )}

          <ul className="p-1.5 space-y-1">
            {blocks.map((b, i) => {
              const open = openId === b.id;
              const empty = b.on && !blockHasValue(b, data);
              return (
                <li key={b.id} className={`rounded-lg ${open ? "bg-gray-950/60 ring-1 ring-gray-800" : ""}`}>
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <div className="flex flex-col gap-px shrink-0">
                      <button type="button" onClick={() => move(b.id, -1)} disabled={i === 0}
                        aria-label={`Move ${blockLabel(b)} up`}
                        className="w-6 sm:w-5 h-[20px] sm:h-[15px] leading-none text-[9px] rounded border border-gray-700 text-gray-400 disabled:opacity-30 hover:text-white">▲</button>
                      <button type="button" onClick={() => move(b.id, 1)} disabled={i === blocks.length - 1}
                        aria-label={`Move ${blockLabel(b)} down`}
                        className="w-6 sm:w-5 h-[20px] sm:h-[15px] leading-none text-[9px] rounded border border-gray-700 text-gray-400 disabled:opacity-30 hover:text-white">▼</button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : b.id)}
                      aria-expanded={open}
                      className="flex-1 min-w-0 text-left"
                    >
                      <span className={`block text-[13px] font-medium truncate ${b.on ? "text-white" : "text-gray-500"}`}>
                        {blockLabel(b)}
                      </span>
                      <span className={`block text-[10.5px] truncate ${open ? "text-gray-300" : "text-gray-500"}`}>
                        {empty ? "nothing entered yet — it stays hidden"
                               : `${zones[zoneFor(b)]} · ${EMPHASIS.find((e) => e.key === b.emphasis)?.label}`}
                      </span>
                    </button>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={b.on}
                      aria-label={`${b.on ? "Hide" : "Show"} ${blockLabel(b)}`}
                      disabled={!b.on && full}
                      title={!b.on && full ? "Your card is full" : undefined}
                      onClick={() => patch(b.id, { on: !b.on })}
                      className={`relative w-[38px] h-[22px] rounded-full shrink-0 transition-colors disabled:opacity-40 ${b.on ? "bg-blue-600" : "bg-gray-700"}`}
                    >
                      <span className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white transition-transform ${b.on ? "translate-x-4" : ""}`} />
                    </button>
                  </div>

                  {open && (
                    <div className="px-2 pb-2.5 pl-9 space-y-2">
                      {b.type === "text" && (
                        <input
                          type="text"
                          value={b.text ?? ""}
                          onChange={(e) => patch(b.id, { text: e.target.value })}
                          placeholder="Type your text"
                          className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                        />
                      )}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-medium text-gray-300 w-12">Size</span>
                        {EMPHASIS.map((e) => (
                          <button key={e.key} type="button" onClick={() => patch(b.id, { emphasis: e.key })}
                            className={`${chip} ${b.emphasis === e.key ? chipOn : chipOff}`}>{e.label}</button>
                        ))}
                      </div>
                      {/* Only marks can move to the side panel — it is a third of
                          the card wide and no size reads well there for text. */}
                      {canChangeZone(b) && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-medium text-gray-300 w-12">Where</span>
                          {(["left", "right"] as CardZone[]).map((z) => (
                            <button key={z} type="button" onClick={() => patch(b.id, { zone: z })}
                              className={`${chip} ${b.zone === z ? chipOn : chipOff}`}>{zones[z]}</button>
                          ))}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => { setBlocks(blocks.filter((x) => x.id !== b.id)); setOpenId(null); }}
                        // Padded to a real target. As a bare text line it was a
                        // 17px-tall tap area on a phone, which is a hard thing
                        // to hit and an easy thing to hit by accident.
                        className="text-[11px] text-red-400 hover:text-red-300 py-1.5 pr-2 -ml-0.5 pl-0.5"
                      >
                        Remove from card
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="px-3 pb-3 pt-1 border-t border-gray-800">
            <p className="text-[11px] text-gray-500 mb-1.5">Add something</p>
            <div className="flex flex-wrap gap-1.5">
              {ADDABLE.filter((a) => !blocks.some((b) =>
                b.type === a.type && b.field === a.field && b.social === a.social && a.type !== "text" && a.type !== "divider",
              )).map((a) => (
                <button
                  key={a.label}
                  type="button"
                  disabled={full}
                  onClick={() => {
                    const id = newBlockId(blocks, a.type === "field" ? String(a.field) : a.type === "social" ? String(a.social) : a.type);
                    setBlocks([...blocks, {
                      id, type: a.type,
                      field: a.field as CustomBlock["field"],
                      social: a.social as CustomBlock["social"],
                      text: a.type === "text" ? "Your text" : undefined,
                      on: true, zone: "right", emphasis: "quiet",
                    }]);
                    setOpenId(id);
                  }}
                  className={`${chip} ${chipOff} disabled:opacity-40`}
                >
                  + {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
