"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

export default function OnboardingForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    username: "",
    name: "",
    title: "",
    company: "",
    email: "",
    phone: "",
    website: "",
    linkedin: "",
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    const cleaned = name === "username" ? value.toLowerCase().replace(/[^a-z0-9-]/g, "") : value;
    setForm((prev) => ({ ...prev, [name]: cleaned }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");

    const { error: insertError } = await supabase.from("profiles").insert({
      id: userId,
      ...form,
    });

    if (insertError) {
      setError(insertError.message.includes("unique") ? "That username is taken. Try another." : insertError.message);
      setStatus("error");
      return;
    }

    router.push("/dashboard");
  }

  const fields = [
    { name: "name", placeholder: "Full name", required: true },
    { name: "title", placeholder: "Job title (e.g. Founder, Sales Director)" },
    { name: "company", placeholder: "Company name" },
    { name: "email", placeholder: "Email address", type: "email" },
    { name: "phone", placeholder: "Phone number", type: "tel" },
    { name: "website", placeholder: "Website (e.g. yoursite.com)" },
    { name: "linkedin", placeholder: "LinkedIn (e.g. linkedin.com/in/yourname)" },
  ];

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-3">
      {/* Username — shown first, special */}
      <div>
        <label className="text-xs text-gray-500 font-medium block mb-1">Your card URL</label>
        <div className="flex items-center bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm focus-within:border-blue-400 transition-colors">
          <span className="text-gray-400 text-sm pl-4 pr-1 shrink-0">evercard.app/card/</span>
          <input
            name="username"
            placeholder="yourname"
            required
            value={form.username}
            onChange={handle}
            className="flex-1 py-3 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:outline-none bg-transparent"
          />
        </div>
      </div>

      <div className="h-px bg-gray-100 my-2" />

      {fields.map((f) => (
        <input
          key={f.name}
          name={f.name}
          type={f.type || "text"}
          placeholder={f.placeholder}
          required={f.required}
          value={form[f.name as keyof typeof form]}
          onChange={handle}
          className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 transition-colors shadow-sm"
        />
      ))}

      {error && <p className="text-red-500 text-xs text-center">{error}</p>}

      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-full transition-colors text-sm mt-2"
      >
        {status === "loading" ? "Creating your card…" : "Create My Card →"}
      </button>
    </form>
  );
}
