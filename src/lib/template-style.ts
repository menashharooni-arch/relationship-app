// Pure normalization for the preset-template style overrides (accent color,
// background surface, hero text color, typography). Kept out of the JSX-heavy
// card-templates module so it can be unit-tested in a plain node env and reused
// by both the templates (via shared.tsx re-export) and the editor forms.
//
// Every field is OPTIONAL. A card with none set — which is every card saved
// before this feature — normalizes to all-undefined, so each template falls
// back to its own baked-in design and nothing about existing cards changes.

import type { CardData } from "@/components/card-templates/types";

export type TemplateStyle = {
  accentColor?: string;
  bgColor?: string;
  textColor?: string;
  fontFamily?: string;
};

// Treat only non-empty strings as a real override. `null`, `undefined`, and
// `""` (a value the editor may send when a field is cleared) all resolve to
// undefined → the template default.
function pick(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}

export function templateStyle(data: Pick<CardData, "customization">): TemplateStyle {
  const c = data.customization ?? {};
  return {
    accentColor: pick(c.accentColor),
    bgColor: pick(c.bgColor),
    textColor: pick(c.textColor),
    fontFamily: pick(c.fontFamily),
  };
}

// Typography choices offered in the editor. One shared list for the control and
// any tests.
export const CARD_FONT_OPTIONS: { label: string; value: string }[] = [
  { label: "Sans (default)", value: "var(--font-geist-sans), system-ui, sans-serif" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Mono", value: "'Courier New', ui-monospace, monospace" },
  { label: "Rounded", value: "'Trebuchet MS', system-ui, sans-serif" },
];
