// Provider-flexible AI completion. Uses whichever pay-as-you-go key is set
// (OpenAI → Gemini → Anthropic), so there are no prepaid credits to run dry.
// Returns null when no provider is configured or the call fails — callers then
// fall back to templates so generation never hard-breaks.

export function hasAiProvider(): boolean {
  return !!(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY);
}

export async function aiComplete(prompt: string, opts?: { maxTokens?: number; json?: boolean }): Promise<string | null> {
  const maxTokens = opts?.maxTokens ?? 300;

  // ── OpenAI (gpt-4o-mini by default) ──
  if (process.env.OPENAI_API_KEY) {
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          max_tokens: maxTokens,
          messages: [{ role: "user", content: prompt }],
          ...(opts?.json ? { response_format: { type: "json_object" } } : {}),
        }),
      });
      const d = await r.json();
      if (r.ok) return (d.choices?.[0]?.message?.content ?? "").trim() || null;
    } catch { /* fall through to null */ }
    return null;
  }

  // ── Google Gemini (gemini-2.0-flash by default) ──
  if (process.env.GEMINI_API_KEY) {
    try {
      const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: maxTokens, ...(opts?.json ? { responseMimeType: "application/json" } : {}) },
        }),
      });
      const d = await r.json();
      if (r.ok) return (d.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim() || null;
    } catch { /* fall through */ }
    return null;
  }

  // ── Anthropic (back-compat; only if a key is still set) ──
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
          max_tokens: maxTokens,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const d = await r.json();
      if (r.ok && Array.isArray(d.content)) return (d.content[0]?.text ?? "").trim() || null;
    } catch { /* fall through */ }
    return null;
  }

  return null;
}

// Vision completion (e.g. business-card OCR). Same provider preference.
export async function aiVision(opts: { imageBase64: string; mediaType: string; prompt: string; maxTokens?: number; json?: boolean }): Promise<string | null> {
  const maxTokens = opts.maxTokens ?? 500;

  if (process.env.OPENAI_API_KEY) {
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          max_tokens: maxTokens,
          messages: [{ role: "user", content: [
            { type: "text", text: opts.prompt },
            { type: "image_url", image_url: { url: `data:${opts.mediaType};base64,${opts.imageBase64}` } },
          ] }],
          ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        }),
      });
      const d = await r.json();
      if (r.ok) return (d.choices?.[0]?.message?.content ?? "").trim() || null;
    } catch { /* fall through */ }
    return null;
  }

  if (process.env.GEMINI_API_KEY) {
    try {
      const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [
            { text: opts.prompt },
            { inline_data: { mime_type: opts.mediaType, data: opts.imageBase64 } },
          ] }],
          generationConfig: { maxOutputTokens: maxTokens, ...(opts.json ? { responseMimeType: "application/json" } : {}) },
        }),
      });
      const d = await r.json();
      if (r.ok) return (d.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim() || null;
    } catch { /* fall through */ }
    return null;
  }

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
          max_tokens: maxTokens,
          messages: [{ role: "user", content: [
            { type: "image", source: { type: "base64", media_type: opts.mediaType, data: opts.imageBase64 } },
            { type: "text", text: opts.prompt },
          ] }],
        }),
      });
      const d = await r.json();
      if (r.ok && Array.isArray(d.content)) return (d.content[0]?.text ?? "").trim() || null;
    } catch { /* fall through */ }
    return null;
  }

  return null;
}
