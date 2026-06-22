"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Profile = {
  username: string;
  name: string;
  title: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  linkedin: string | null;
};

export default function ProfileForm({ profile }: { profile: Profile }) {
  const [form, setForm] = useState({
    name: profile.name || "",
    title: profile.title || "",
    company: profile.company || "",
    email: profile.email || "",
    phone: profile.phone || "",
    website: profile.website || "",
    linkedin: profile.linkedin || "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "saved" | "error">("idle");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");

    const { error } = await supabase
      .from("profiles")
      .update(form)
      .eq("username", profile.username);

    setStatus(error ? "error" : "saved");
    if (!error) setTimeout(() => setStatus("idle"), 2000);
  }

  const fields = [
    { name: "name", label: "Full name", required: true },
    { name: "title", label: "Job title" },
    { name: "company", label: "Company" },
    { name: "email", label: "Email", type: "email" },
    { name: "phone", label: "Phone", type: "tel" },
    { name: "website", label: "Website" },
    { name: "linkedin", label: "LinkedIn URL" },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 mb-2">
        <p className="text-xs text-gray-500">Card URL</p>
        <p className="text-blue-400 text-sm">evercard.app/card/{profile.username}</p>
      </div>

      {fields.map((f) => (
        <div key={f.name}>
          <label className="text-xs text-gray-500 block mb-1">{f.label}</label>
          <input
            name={f.name}
            type={f.type || "text"}
            required={f.required}
            value={form[f.name as keyof typeof form]}
            onChange={handle}
            className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      ))}

      {status === "error" && <p className="text-red-400 text-xs text-center">Something went wrong.</p>}

      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-full transition-colors text-sm"
      >
        {status === "loading" ? "Saving…" : status === "saved" ? "Saved ✓" : "Save Changes"}
      </button>
    </form>
  );
}
