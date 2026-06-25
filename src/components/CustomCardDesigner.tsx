"use client";

import { useRef, useState } from "react";
import type { CardData, CustomElement, CustomField, CustomLayout } from "@/components/card-templates/types";
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
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
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
    const id = `el-${idRef.current}-${layout.elements.length}`;
    onChange({ ...layout, elements: [...layout.elements, { ...el, id }] });
    setSelectedId(id);
  }
  function removeEl(id: string) {
    onChange({ ...layout, elements: layout.elements.filter((e) => e.id !== id) });
    setSelectedId(null);
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
  const isTextish = selected?.type === "field" || selected?.type === "text" || selected?.type === "socials";

  return (
    <div className="space-y-3">
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
      </div>
      <p className="text-[11px] text-gray-600">Drag any element to move it. Tap an element to edit it.</p>

      {/* Add elements */}
      <div>
        <p className="text-xs font-medium text-gray-400 mb-2">Add to card</p>
        <div className="flex flex-wrap gap-1.5">
          {FIELD_OPTIONS.map((f) => (
            <button key={f.value} type="button" onClick={() => addEl({ type: "field", field: f.value, x: 10, y: 10, fontSize: 12 })}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors">
              + {f.label}
            </button>
          ))}
          <button type="button" onClick={() => addEl({ type: "text", text: "New text", x: 10, y: 10, fontSize: 12 })}
            className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors">+ Text box</button>
          <button type="button" onClick={() => addEl({ type: "logo", x: 70, y: 10, size: 46 })}
            className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors">+ Logo</button>
          <button type="button" onClick={() => addEl({ type: "headshot", x: 70, y: 40, size: 60 })}
            className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors">+ Headshot</button>
          <button type="button" onClick={() => addEl({ type: "socials", x: 10, y: 85, fontSize: 9 })}
            className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors">+ Socials</button>
        </div>
      </div>

      {/* Card styles */}
      <div className="grid grid-cols-2 gap-3 bg-gray-900 border border-gray-800 rounded-xl p-3">
        <label className="flex items-center justify-between gap-2 text-xs text-gray-400">
          Background
          <input type="color" value={layout.background} onChange={(e) => update({ background: e.target.value })} className="w-7 h-7 rounded bg-transparent border border-gray-700" />
        </label>
        <label className="flex items-center justify-between gap-2 text-xs text-gray-400">
          Text color
          <input type="color" value={layout.textColor} onChange={(e) => update({ textColor: e.target.value })} className="w-7 h-7 rounded bg-transparent border border-gray-700" />
        </label>
        <label className="col-span-2 flex items-center justify-between gap-2 text-xs text-gray-400">
          Font
          <select value={layout.fontFamily} onChange={(e) => update({ fontFamily: e.target.value })}
            className="flex-1 ml-2 bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500">
            {FONT_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </label>
      </div>

      {/* Selected element controls */}
      {selected ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-white capitalize">{selected.type === "field" ? selected.field : selected.type}</p>
            <button type="button" onClick={() => removeEl(selected.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
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

          {isTextish && (
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center justify-between gap-2 text-xs text-gray-400">
                Size
                <input type="number" min={6} max={48} value={selected.fontSize ?? 12} onChange={(e) => updateEl(selected.id, { fontSize: Number(e.target.value) })}
                  className="w-16 bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500" />
              </label>
              <label className="flex items-center justify-between gap-2 text-xs text-gray-400">
                Color
                <input type="color" value={selected.color ?? layout.textColor} onChange={(e) => updateEl(selected.id, { color: e.target.value })}
                  className="w-7 h-7 rounded bg-transparent border border-gray-700" />
              </label>
              {(selected.type === "field" || selected.type === "text") && (
                <label className="col-span-2 flex items-center gap-2 text-xs text-gray-400">
                  <input type="checkbox" checked={!!selected.bold} onChange={(e) => updateEl(selected.id, { bold: e.target.checked })} />
                  Bold
                </label>
              )}
            </div>
          )}

          {isImg && (
            <label className="flex items-center justify-between gap-2 text-xs text-gray-400">
              Size (px)
              <input type="number" min={24} max={160} value={selected.size ?? 48} onChange={(e) => updateEl(selected.id, { size: Number(e.target.value) })}
                className="w-20 bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500" />
            </label>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-gray-600">Select an element on the card to change its font size, color, and position.</p>
      )}
    </div>
  );
}
