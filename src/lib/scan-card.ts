// Client-side business-card scanning. Mobile camera photos are huge (several MB,
// 4000px+), which makes the AI scan slow and can make the request hang. We
// downscale + JPEG-compress first, and time the request out so the UI never gets
// stuck on a spinner.

export type ScannedCard = {
  name?: string;
  title?: string;
  company?: string;
  phone?: string;
  email?: string;
  website?: string;
};

export class ProRequiredError extends Error {
  constructor(message = "Card scanner is a Pro feature. Upgrade to use it.") { super(message); this.name = "ProRequiredError"; }
}

const SCAN_TIMEOUT_MS = 45_000;

export async function scanBusinessCard(file: File): Promise<ScannedCard> {
  const { base64, mediaType } = await compressToBase64(file);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);
  try {
    const res = await fetch("/api/scanner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: base64, mediaType }),
      signal: controller.signal,
    });
    // 402 = free monthly scans used up · 403 = scanner not on this plan.
    if (res.status === 402 || res.status === 403) {
      const data = await res.json().catch(() => ({} as { message?: string }));
      throw new ProRequiredError(data.message || undefined);
    }
    if (!res.ok) throw new Error("scan_failed");
    return (await res.json()) as ScannedCard;
  } finally {
    clearTimeout(timer);
  }
}

async function compressToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  const dataUrl = await readAsDataURL(file);
  try {
    const img = await loadImage(dataUrl);
    const MAX = 1600;
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    if (Math.max(w, h) > MAX) {
      const s = MAX / Math.max(w, h);
      w = Math.round(w * s);
      h = Math.round(h * s);
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx || !w || !h) return rawFrom(dataUrl);
    ctx.drawImage(img, 0, 0, w, h);
    const out = canvas.toDataURL("image/jpeg", 0.82);
    // Guard against a blank/failed canvas export.
    if (!out || out.length < 1000) return rawFrom(dataUrl);
    return { base64: out.split(",")[1], mediaType: "image/jpeg" };
  } catch {
    // Any decode/canvas failure → send the original bytes rather than nothing.
    return rawFrom(dataUrl);
  }
}

function rawFrom(dataUrl: string): { base64: string; mediaType: string } {
  const [prefix, b64] = dataUrl.split(",");
  const mediaType = prefix.split(":")[1]?.split(";")[0] || "image/jpeg";
  return { base64: b64, mediaType };
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("read_failed"));
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image_failed"));
    img.src = src;
  });
}
