"use client";

// Pro custom-card designer.
//
// The preview is the REAL renderer (CustomBlockCard) inside CardScaler at the
// same 460 design width the public card page uses. That is deliberate and it is
// the single most important thing in this file: the previous designer drew its
// own canvas at whatever width the column happened to be, while element sizes
// were absolute px — so the same name filled 35.5% of the card while you
// designed it and 24.7% once it published. Sharing one renderer makes that class
// of drift unrepresentable rather than merely fixed.
//
// Everything the owner can do is a forgiving operation: toggle a block on or
// off, move it between two zones, change its order, or set its emphasis. There
// is no coordinate to get wrong and no font size to type, so no sequence of
// actions produces a broken card.

import { useMemo, useRef, useState } from "react";
import type { CardData, CardEmphasis, CardSkeleton, CardZone, CustomBlock, CustomLayout } from "@/components/card-templates/types";
import { CustomBlockCard } from "@/components/card-templates/CustomCard";
import CardScaler from "@/components/CardScaler";
import {
  ADDABLE, LAYOUT_PRESETS, MAX_VISIBLE_BLOCKS, SKELETONS, blockHasValue, blockLabel,
  buildPreset, hasBlocks, isFull, legacyToBlocks, newBlockId, zoneLabels,
} from "@/lib/custom-layout";

const FONTS = [
  { label: "Sans", value: "var(--font-geist-sans), system-ui, sans-serif" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Mono", value: "'Courier New', ui-monospace, monospace" },
  { label: "Rounded", value: "'Trebuchet MS', system-ui, sans-serif" },
];

// Coordinated grounds. Each carries its own text + accent so one tap restyles
// the whole card correctly, instead of leaving the owner to fix six colours by
// hand after changing the background.
const GROUNDS = [
  { label: "Navy",     background: "#2c3a52", textColor: "#ffffff", accentColor: "#ffffff" },
  { label: "Midnight", background: "#141b26", textColor: "#ffffff", accentColor: "#7fa6f0" },
  { label: "Indigo",   background: "#312e81", textColor: "#ffffff", accentColor: "#c7d2fe" },
  { label: "Forest",   background: "#16352c", textColor: "#ffffff", accentColor: "#8fd3b6" },
  { label: "Oxblood",  background: "#3a1d22", textColor: "#ffffff", accentColor: "#e9a6a2" },
  { label: "Graphite", background: "#1f2430", textColor: "#ffffff", accentColor: "#9fb2cc" },
  { label: "Ivory",    background: "#faf9f6", textColor: "#1c1612", accentColor: "#b08d57" },
  { label: "Bone",     background: "#f4f2ed", textColor: "#141b26", accentColor: "#2c3a52" },
];

const EMPHASIS: { key: CardEmphasis; label: string }[] = [
  { key: "hero", label: "Big" },
  { key: "normal", label: "Normal" },
  { key: "quiet", label: "Small" },
];

export default function CustomCardDesigner({
  layout,
  data,
  onChange,
}: {
  layout: CustomLayout;
  data: CardData;
  onChange: (layout: CustomLayout) => void;
}) {
  const history = useRef<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  const started = hasBlocks(layout);
  const blocks = useMemo(() => layout.blocks ?? [], [layout.blocks]);
  const zones = zoneLabels(layout.skeleton);
  const full = isFull(blocks);

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

  // Preview data with THIS layout applied, so the card reflects edits instantly.
  const previewData: CardData = useMemo(
    () => ({ ...data, customization: { ...(data.customization ?? {}), customLayout: layout } }),
    [data, layout],
  );

  // Tapping the card selects that block — the card itself is a control, not just
  // an output. Delegation reads the data-cb the renderer emits, which keeps
  // CustomCard free of handlers and therefore still server-renderable.
  function onCardPointerDown(e: React.PointerEvent) {
    const hit = (e.target as HTMLElement).closest?.("[data-cb]");
    const id = hit?.getAttribute("data-cb");
    if (id) setOpenId((cur) => (cur === id ? null : id));
  }

  const chip = "text-[12px] px-3 py-1.5 rounded-lg border transition-colors";
  const chipOff = "bg-gray-900 border-gray-700 text-gray-300 hover:text-white hover:border-gray-500";
  const chipOn = "bg-blue-600 border-blue-600 text-white";

  // ── First run: pick a starting point, never a blank canvas ────────────────
  if (!started) {
    const legacy = Array.isArray(layout.elements) && layout.elements.length > 0;
    return (
      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-white">Start from a design</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Pick one, then change anything. You&apos;re never staring at an empty card.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(LAYOUT_PRESETS).map(([key, p]) => {
            const preset = buildPreset(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => commit(preset)}
                className="text-left rounded-xl border border-gray-700 hover:border-blue-500 bg-gray-900 p-2 transition-colors"
              >
                <div className="pointer-events-none rounded-lg overflow-hidden mb-2">
                  <CardScaler>
                    <CustomBlockCard
                      data={{ ...data, customization: { ...(data.customization ?? {}), customLayout: preset } }}
                      placeholder
                    />
                  </CardScaler>
                </div>
                <p className="text-xs font-semibold text-white">{p.label}</p>
                <p className="text-[10.5px] text-gray-500 leading-snug">{p.blurb}</p>
              </button>
            );
          })}
        </div>
        {legacy && (
          <button
            type="button"
            onClick={() => commit({ ...layout, blocks: legacyToBlocks(layout.elements) })}
            className="w-full text-xs text-gray-400 hover:text-white underline underline-offset-2 py-1"
          >
            Or rebuild the design I already had
          </button>
        )}
      </div>
    );
  }

  // ── Editor ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Live card — the real renderer, at the real design width. */}
      <div onPointerDown={onCardPointerDown} className="cursor-pointer">
        <CardScaler>
          <CustomBlockCard data={previewData} placeholder />
        </CardScaler>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-gray-500">Tap anything on the card to style it.</p>
        <button
          type="button"
          onClick={undo}
          disabled={!canUndo}
          className="text-[11px] px-2.5 py-1 rounded-lg border border-gray-700 text-gray-300 disabled:opacity-40 hover:border-gray-500"
        >
          ↶ Undo
        </button>
      </div>

      {/* Ground + font — one tap restyles the whole card coherently. */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-2.5">
        <p className="text-xs font-medium text-gray-400">Look</p>
        <div className="flex flex-wrap gap-1.5">
          {GROUNDS.map((g) => (
            <button
              key={g.label}
              type="button"
              title={g.label}
              aria-label={g.label}
              onClick={() => commit({ ...layout, background: g.background, textColor: g.textColor, accentColor: g.accentColor })}
              className="w-8 h-8 rounded-lg transition-transform hover:scale-110"
              style={{
                background: g.background,
                boxShadow: layout.background === g.background
                  ? "0 0 0 2px #3b82f6"
                  : "inset 0 0 0 1px rgba(148,163,184,.35)",
              }}
            />
          ))}
          <label className="flex items-center gap-1.5 text-[10px] text-gray-500 ml-1">
            custom
            <input
              type="color"
              aria-label="Custom background"
              value={/^#[0-9a-f]{6}$/i.test(layout.background) ? layout.background : "#2c3a52"}
              onChange={(e) => commit({ ...layout, background: e.target.value })}
              className="w-7 h-7 rounded bg-transparent border border-gray-700"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-1.5">
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

      {/* Arrangement */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-2">
        <p className="text-xs font-medium text-gray-400">Arrangement</p>
        <div className="flex flex-wrap gap-1.5">
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

      {/* What's on the card */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-800">
          <p className="text-xs font-medium text-gray-400">What&apos;s on your card</p>
          <p className={`text-[11px] ${full ? "text-amber-400" : "text-gray-600"}`}>
            {blocks.filter((b) => b.on).length} of {MAX_VISIBLE_BLOCKS}
          </p>
        </div>
        {full && (
          <p className="px-3 pt-2 text-[11px] text-amber-400/90">
            Your card is full — turn something off to add something else. A card this size
            stays readable up to {MAX_VISIBLE_BLOCKS} things.
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
                      className="w-5 h-[15px] leading-none text-[9px] rounded border border-gray-700 text-gray-400 disabled:opacity-30 hover:text-white">▲</button>
                    <button type="button" onClick={() => move(b.id, 1)} disabled={i === blocks.length - 1}
                      aria-label={`Move ${blockLabel(b)} down`}
                      className="w-5 h-[15px] leading-none text-[9px] rounded border border-gray-700 text-gray-400 disabled:opacity-30 hover:text-white">▼</button>
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
                    <span className="block text-[10.5px] text-gray-500 truncate">
                      {empty ? "nothing entered yet — it stays hidden" : `${zones[b.zone]} · ${EMPHASIS.find((e) => e.key === b.emphasis)?.label}`}
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
                      <span className="text-[10.5px] text-gray-500 w-12">Size</span>
                      {EMPHASIS.map((e) => (
                        <button key={e.key} type="button" onClick={() => patch(b.id, { emphasis: e.key })}
                          className={`${chip} ${b.emphasis === e.key ? chipOn : chipOff}`}>{e.label}</button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10.5px] text-gray-500 w-12">Where</span>
                      {(["left", "right"] as CardZone[]).map((z) => (
                        <button key={z} type="button" onClick={() => patch(b.id, { zone: z })}
                          className={`${chip} ${b.zone === z ? chipOn : chipOff}`}>{zones[z]}</button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => { setBlocks(blocks.filter((x) => x.id !== b.id)); setOpenId(null); }}
                      className="text-[11px] text-red-400 hover:text-red-300"
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

      <button
        type="button"
        onClick={() => commit({ ...layout, blocks: undefined })}
        className="text-[11px] text-gray-500 hover:text-gray-300 underline underline-offset-2"
      >
        Start from a different design
      </button>
    </div>
  );
}
