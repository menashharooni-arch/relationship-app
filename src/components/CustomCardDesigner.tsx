"use client";

// Pro custom-card designer: tap a chip to add anything to the card — info
// fields, photos, any social platform, a QR code, text, dividers — then drag
// it anywhere and style it. The renderer (CustomCard) stays server-safe; all
// interactivity lives here.

import { useRef, useState } from "react";
import type { CardData, CustomElement, CustomField, CustomLayout, CustomSocial } from "@/components/card-templates/types";
import { CustomElementContent } from "@/components/card-templates/CustomCard";

const FONT_OPTIONS = [
  { label: "Sans (default)", value: "var(--font-geist-sans), system-ui, sans-serif" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Mono", value: "'Courier New', ui-monospace, monospace" },
  { label: "Rounded", value: "'Trebuchet MS', system-ui, sans-serif" },
];

const FIELD_OPTIONS: { value: CustomField; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "title", label: "Job title" },
  { value: "company", label: "Company" },
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "website", label: "Website" },
  { value: "address", label: "Address" },
  { value: "fax", label: "Fax" },
];

const SOCIAL_OPTIONS: { value: CustomSocial; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "twitter", label: "X (Twitter)" },
  { value: "tiktok", label: "TikTok" },
  { value: "snapchat", label: "Snapchat" },
  { value: "youtube", label: "YouTube" },
  { value: "facebook", label: "Facebook" },
];

// Background presets: brand solids + a few designed gradients.
const BG_PRESETS = [
  "#0e1b35", "#070d1c", "#1c1612", "#ffffff", "#fafaf6", "#fffbf0",
  "linear-gradient(135deg, #0e1b35 0%, #2563eb 100%)",
  "linear-gradient(135deg, #111827 0%, #6d28d9 100%)",
  "linear-gradient(135deg, #7c2d12 0%, #f59e0b 100%)",
  "linear-gradient(135deg, #064e3b 0%, #10b981 100%)",
  "linear-gradient(135deg, #1c1612 0%, #b08d57 100%)",
  "linear-gradient(135deg, #831843 0%, #ec4899 100%)",
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function isHex(v: string) {
  return /^#[0-9a-fA-F]{6}$/.test(v);
}

export default function CustomCardDesigner({
  layout,
  data,
  onChange,
}: {
  layout: CustomLayout;
  data: CardData;
  onChange: (layout: CustomLayout) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; elX: number; elY: number } | null>(null);
  const idRef = useRef(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = layout.elements.find((e) => e.id === selectedId) ?? null;

  function update(patch: Partial<CustomLayout>) {
    onChange({ ...layout, ...patch });
  }
  function updateEl(id: string, patch: Partial<CustomElement>) {
    onChange({ ...layout, elements: layout.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  }
  function addEl(el: Omit<CustomElement, "id">) {
    idRef.current += 1;
    const id = `el-${Date.now().toString(36)}-${idRef.current}`;
    onChange({ ...layout, elements: [...layout.elements, { ...el, id }] });
    setSelectedId(id);
  }
  function removeEl(id: string) {
    onChange({ ...layout, elements: layout.elements.filter((e) => e.id !== id) });
    setSelectedId(null);
  }
  function duplicateEl(el: CustomElement) {
    const { id: _old, ...rest } = el;
    void _old;
    addEl({ ...rest, x: clamp(el.x + 4, 0, 96), y: clamp(el.y + 6, 0, 94) });
  }

  function startDrag(e: React.PointerEvent, el: CustomElement) {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(el.id);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { id: el.id, startX: e.clientX, startY: e.clientY, elX: el.x, elY: el.y };
  }
  function onDrag(e: React.PointerEvent) {
    const d = dragRef.current;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!d || !rect) return;
    const dx = ((e.clientX - d.startX) / rect.width) * 100;
    const dy = ((e.clientY - d.startY) / rect.height) * 100;
    updateEl(d.id, { x: clamp(d.elX + dx, 0, 96), y: clamp(d.elY + dy, 0, 94) });
  }
  function endDrag() {
    dragRef.current = null;
  }

  const isImg = selected?.type === "logo" || selected?.type === "headshot";
  const isTextish = selected?.type === "field" || selected?.type === "text" || selected?.type === "socials" || selected?.type === "social";
  const chip = "text-[11px] px-2.5 py-1 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors";
  const label = "flex items-center justify-between gap-2 text-xs text-gray-400";
  const numInput = "w-16 bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500";

  return (
    <div className="space-y-3">
      {/* How it works */}
      <div className="rounded-xl bg-blue-950/30 border border-blue-800/40 px-3.5 py-2.5">
        <p className="text-blue-200 text-[11px] leading-relaxed">
          <strong>Design anything you want:</strong> ① tap a chip below to add it to the card
          &nbsp;② drag it exactly where you want it &nbsp;③ tap it to change size, color &amp; style
          &nbsp;④ pick a background. Everything updates live.
        </p>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        onPointerDown={() => setSelectedId(null)}
        className="relative w-full select-none"
        style={{
          aspectRatio: "1.75 / 1",
          background: layout.background,
          fontFamily: layout.fontFamily,
          color: layout.textColor,
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        {layout.elements.map((el) => (
          <div
            key={el.id}
            onPointerDown={(e) => startDrag(e, el)}
            onPointerMove={onDrag}
            onPointerUp={endDrag}
            style={{
              position: "absolute",
              left: `${el.x}%`,
              top: `${el.y}%`,
              cursor: "move",
              touchAction: "none",
              outline: selectedId === el.id ? "2px solid #3b82f6" : "none",
              outlineOffset: 2,
              borderRadius: 4,
            }}
          >
            <CustomElementContent el={el} data={data} layout={layout} placeholder />
          </div>
        ))}
        {layout.elements.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-xs opacity-50">Tap a chip below to start designing</p>
          </div>
        )}
      </div>

      {/* Add: your info */}
      <div>
        <p className="text-xs font-medium text-gray-400 mb-1.5">Your info</p>
        <div className="flex flex-wrap gap-1.5">
          {FIELD_OPTIONS.map((f) => (
            <button key={f.value} type="button" onClick={() => addEl({ type: "field", field: f.value, x: 8, y: 10, fontSize: f.value === "name" ? 20 : 11, bold: f.value === "name" })} className={chip}>
              + {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Add: photos + extras */}
      <div>
        <p className="text-xs font-medium text-gray-400 mb-1.5">Photos &amp; extras</p>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => addEl({ type: "logo", x: 72, y: 10, size: 46 })} className={chip}>+ Logo</button>
          <button type="button" onClick={() => addEl({ type: "headshot", x: 72, y: 40, size: 60 })} className={chip}>+ Headshot</button>
          <button type="button" onClick={() => addEl({ type: "qr", x: 78, y: 62, size: 52 })} className={chip}>+ QR code</button>
          <button type="button" onClick={() => addEl({ type: "text", text: "Your text", x: 8, y: 50, fontSize: 12 })} className={chip}>+ Text box</button>
          <button type="button" onClick={() => addEl({ type: "divider", x: 8, y: 46, width: 80 })} className={chip}>+ Divider line</button>
        </div>
      </div>

      {/* Add: socials — any platform, or all handles at once */}
      <div>
        <p className="text-xs font-medium text-gray-400 mb-1.5">Socials <span className="text-gray-600 font-normal">— icon + your handle (fill handles in the Socials step)</span></p>
        <div className="flex flex-wrap gap-1.5">
          {SOCIAL_OPTIONS.map((s) => (
            <button key={s.value} type="button" onClick={() => addEl({ type: "social", social: s.value, x: 8, y: 84, fontSize: 10 })} className={chip}>
              + {s.label}
            </button>
          ))}
          <button type="button" onClick={() => addEl({ type: "socials", x: 8, y: 90, fontSize: 9 })} className={chip}>+ All handles (text row)</button>
        </div>
      </div>

      {/* Card styles */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-3">
        <div>
          <p className="text-xs text-gray-400 mb-1.5">Background</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {BG_PRESETS.map((bg) => (
              <button
                key={bg}
                type="button"
                onClick={() => update({ background: bg })}
                aria-label="Background preset"
                className="w-7 h-7 rounded-lg border transition-transform hover:scale-110"
                style={{ background: bg, borderColor: layout.background === bg ? "#3b82f6" : "#374151", borderWidth: layout.background === bg ? 2 : 1 }}
              />
            ))}
            <label className="flex items-center gap-1.5 text-[10px] text-gray-500 ml-1">
              custom
              <input
                type="color"
                value={isHex(layout.background) ? layout.background : "#0e1b35"}
                onChange={(e) => update({ background: e.target.value })}
                className="w-7 h-7 rounded bg-transparent border border-gray-700"
              />
            </label>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            Text color
            <input type="color" value={isHex(layout.textColor) ? layout.textColor : "#ffffff"} onChange={(e) => update({ textColor: e.target.value })} className="w-7 h-7 rounded bg-transparent border border-gray-700" />
          </label>
          <label className={label}>
            Font
            <select value={layout.fontFamily} onChange={(e) => update({ fontFamily: e.target.value })}
              className="flex-1 ml-1 bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500">
              {FONT_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </label>
        </div>
      </div>

      {/* Selected element controls */}
      {selected ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-white capitalize">
              {selected.type === "field" ? selected.field : selected.type === "social" ? selected.social : selected.type}
            </p>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => duplicateEl(selected)} className="text-xs text-gray-400 hover:text-white">Duplicate</button>
              <button type="button" onClick={() => removeEl(selected.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
            </div>
          </div>

          {selected.type === "text" && (
            <input type="text" value={selected.text ?? ""} onChange={(e) => updateEl(selected.id, { text: e.target.value })}
              placeholder="Text" className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500" />
          )}

          {selected.type === "field" && (
            <select value={selected.field} onChange={(e) => updateEl(selected.id, { field: e.target.value as CustomField })}
              className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500">
              {FIELD_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          )}

          {selected.type === "social" && (
            <select value={selected.social} onChange={(e) => updateEl(selected.id, { social: e.target.value as CustomSocial })}
              className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500">
              {SOCIAL_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          )}

          {isTextish && (
            <div className="grid grid-cols-2 gap-3">
              <label className={label}>
                Size
                <input type="number" min={6} max={48} value={selected.fontSize ?? 12} onChange={(e) => updateEl(selected.id, { fontSize: Number(e.target.value) })} className={numInput} />
              </label>
              <label className={label}>
                Color
                <input type="color" value={selected.color ?? (isHex(layout.textColor) ? layout.textColor : "#ffffff")} onChange={(e) => updateEl(selected.id, { color: e.target.value })}
                  className="w-7 h-7 rounded bg-transparent border border-gray-700" />
              </label>
              {(selected.type === "field" || selected.type === "text") && (
                <div className="col-span-2 flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs text-gray-400">
                    <input type="checkbox" checked={!!selected.bold} onChange={(e) => updateEl(selected.id, { bold: e.target.checked })} />
                    Bold
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-400">
                    <input type="checkbox" checked={!!selected.italic} onChange={(e) => updateEl(selected.id, { italic: e.target.checked })} />
                    Italic
                  </label>
                </div>
              )}
            </div>
          )}

          {(isImg || selected.type === "qr") && (
            <label className={label}>
              Size (px)
              <input type="number" min={24} max={160} value={selected.size ?? 48} onChange={(e) => updateEl(selected.id, { size: Number(e.target.value) })} className="w-20 bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500" />
            </label>
          )}

          {selected.type === "divider" && (
            <div className="grid grid-cols-2 gap-3">
              <label className={label}>
                Width (px)
                <input type="number" min={20} max={400} value={selected.width ?? 80} onChange={(e) => updateEl(selected.id, { width: Number(e.target.value) })} className={numInput} />
              </label>
              <label className={label}>
                Color
                <input type="color" value={selected.color ?? (isHex(layout.textColor) ? layout.textColor : "#ffffff")} onChange={(e) => updateEl(selected.id, { color: e.target.value })}
                  className="w-7 h-7 rounded bg-transparent border border-gray-700" />
              </label>
            </div>
          )}

          {/* Precise position — great on phones where dragging is fiddly */}
          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-gray-800">
            <label className={label}>
              ↔ Left–right
              <input type="range" min={0} max={96} value={selected.x} onChange={(e) => updateEl(selected.id, { x: Number(e.target.value) })} className="flex-1 ml-1 accent-blue-500" />
            </label>
            <label className={label}>
              ↕ Up–down
              <input type="range" min={0} max={94} value={selected.y} onChange={(e) => updateEl(selected.id, { y: Number(e.target.value) })} className="flex-1 ml-1 accent-blue-500" />
            </label>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-gray-600">Tap any element on the card to style it (size, color, bold, exact position) or delete it.</p>
      )}
    </div>
  );
}
