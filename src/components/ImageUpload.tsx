"use client";

import { useRef, useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";

type Props = {
  field: "photo" | "logo";
  currentUrl: string | null;
  label: string;
  shape?: "circle" | "square";
  onUploaded: (url: string) => void;
};

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = new Image();
  image.src = imageSrc;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
  });

  const canvas = document.createElement("canvas");
  const size = Math.min(pixelCrop.width, pixelCrop.height, 800);
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    size,
    size
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas export failed"))),
      "image/jpeg",
      0.92
    );
  });
}

export default function ImageUpload({ field, currentUrl, label, shape = "square", onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Crop state
  const [rawSrc, setRawSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRawSrc(URL.createObjectURL(file));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    e.target.value = "";
  }

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function applyCrop() {
    if (!rawSrc || !croppedAreaPixels) return;
    setUploadStatus("uploading");
    setErrorMsg("");

    try {
      const blob = await getCroppedImg(rawSrc, croppedAreaPixels);
      const file = new File([blob], `${field}.jpg`, { type: "image/jpeg" });
      const form = new FormData();
      form.append("file", file);
      form.append("field", field);

      const res = await fetch("/api/upload", { method: "POST", body: form });
      const json = await res.json();

      if (!res.ok) {
        setErrorMsg(json.error ?? "Upload failed");
        setUploadStatus("error");
        return;
      }

      setPreview(json.url);
      setRawSrc(null);
      setUploadStatus("idle");
      onUploaded(json.url);
    } catch {
      setErrorMsg("Upload failed — check your connection");
      setUploadStatus("error");
    }
  }

  function cancelCrop() {
    setRawSrc(null);
    setUploadStatus("idle");
  }

  const isCircle = shape === "circle";

  return (
    <>
      {/* Full-screen crop modal */}
      {rawSrc && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col" style={{ touchAction: "none" }}>
          {/* Top bar */}
          <div className="flex items-center justify-between px-5 shrink-0" style={{ paddingTop: "env(safe-area-inset-top, 16px)", paddingBottom: 12 }}>
            <button
              type="button"
              onClick={cancelCrop}
              className="text-white font-medium text-sm py-2 px-1"
            >
              Cancel
            </button>
            <p className="text-white font-semibold text-sm">
              {isCircle ? "Adjust profile photo" : "Adjust logo"}
            </p>
            <button
              type="button"
              onClick={applyCrop}
              disabled={uploadStatus === "uploading"}
              className="text-sm font-bold py-2 px-4 rounded-full transition-colors disabled:opacity-50"
              style={{ background: "#2563eb", color: "#fff" }}
            >
              {uploadStatus === "uploading" ? "Saving…" : "Apply"}
            </button>
          </div>

          {/* Crop area — fills remaining space */}
          <div className="relative flex-1 overflow-hidden">
            <Cropper
              image={rawSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape={isCircle ? "round" : "rect"}
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              style={{
                containerStyle: { background: "#000" },
                cropAreaStyle: {
                  border: "2px solid rgba(255,255,255,0.85)",
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
                },
              }}
            />
          </div>

          {/* Bottom controls */}
          <div className="px-8 shrink-0" style={{ paddingTop: 20, paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 28px)" }}>
            {/* Zoom slider */}
            <div className="flex items-center gap-4 mb-3">
              <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: "#3b82f6" }}
              />
              <svg className="w-5 h-5 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
              </svg>
            </div>
            <p className="text-center text-gray-600 text-xs">
              Drag to move · pinch or slide to zoom
            </p>
          </div>
        </div>
      )}

      {/* Normal upload widget */}
      <div>
        <label className="text-xs text-gray-500 block mb-2">{label}</label>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-20 h-20 overflow-hidden border-2 border-dashed flex items-center justify-center shrink-0 transition-all hover:border-blue-500"
            style={{
              borderRadius: isCircle ? "9999px" : "12px",
              borderColor: "#374151",
              background: "#111827",
            }}
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt={label}
                className="w-full h-full object-cover"
                style={{ borderRadius: isCircle ? "9999px" : "10px" }}
              />
            ) : (
              <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
            )}
          </button>

          <div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploadStatus === "uploading"}
              className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50 block mb-1"
            >
              {uploadStatus === "uploading" ? "Uploading…" : preview ? "Change photo" : "Upload photo"}
            </button>
            <p className="text-[11px] text-gray-600">JPG, PNG · max 5 MB</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Tap to select · then drag &amp; zoom to fit</p>
            {uploadStatus === "error" && (
              <p className="text-[11px] text-red-400 mt-1">{errorMsg}</p>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
      </div>
    </>
  );
}
