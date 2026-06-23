"use client";

import { useRef, useState } from "react";

type Props = {
  field: "photo" | "logo";
  currentUrl: string | null;
  label: string;
  shape?: "circle" | "square";
  onUploaded: (url: string) => void;
};

export default function ImageUpload({ field, currentUrl, label, shape = "square", onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local preview immediately
    setPreview(URL.createObjectURL(file));
    setStatus("uploading");
    setErrorMsg("");

    const form = new FormData();
    form.append("file", file);
    form.append("field", field);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error ?? "Upload failed");
        setStatus("error");
        setPreview(currentUrl);
        return;
      }
      setStatus("idle");
      onUploaded(json.url);
    } catch {
      setErrorMsg("Upload failed — check your connection");
      setStatus("error");
      setPreview(currentUrl);
    }
  }

  const isCircle = shape === "circle";
  const containerClass = isCircle
    ? "w-20 h-20 rounded-full"
    : "w-20 h-20 rounded-xl";

  return (
    <div>
      <label className="text-xs text-gray-500 block mb-2">{label}</label>
      <div className="flex items-center gap-4">
        {/* Preview */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`${containerClass} overflow-hidden border-2 border-dashed flex items-center justify-center shrink-0 transition-colors`}
          style={{
            borderColor: status === "uploading" ? "#3b82f6" : "#374151",
            background: "#111827",
          }}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt={label}
              className={`w-full h-full object-cover ${isCircle ? "rounded-full" : "rounded-xl"}`}
            />
          ) : (
            <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
            </svg>
          )}
        </button>

        {/* Text + button */}
        <div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={status === "uploading"}
            className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50 block mb-1"
          >
            {status === "uploading" ? "Uploading…" : preview ? "Change image" : "Upload image"}
          </button>
          <p className="text-[11px] text-gray-600">JPG, PNG, WebP · max 5 MB</p>
          {status === "error" && (
            <p className="text-[11px] text-red-400 mt-1">{errorMsg}</p>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleFile}
        />
      </div>
    </div>
  );
}
