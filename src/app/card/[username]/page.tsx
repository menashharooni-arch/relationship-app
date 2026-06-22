import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import SaveContactButton from "@/components/SaveContactButton";
import LeadCaptureForm from "@/components/LeadCaptureForm";

function ContactRow({ icon, value, href }: { icon: React.ReactNode; value: string; href: string }) {
  return (
    <div className="border-b border-gray-100 last:border-0">
      <a
        href={href}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel="noopener noreferrer"
        className="flex items-center gap-4 py-3 group"
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, #dbeafe, #ede9fe)" }}
        >
          <span className="w-5 h-5 flex items-center justify-center text-indigo-500">
            {icon}
          </span>
        </div>
        <span className="text-sm text-gray-600 group-hover:text-blue-600 transition-colors truncate">
          {value}
        </span>
      </a>
    </div>
  );
}

export default async function CardPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single();

  if (!profile) notFound();

  const person = {
    name: profile.name,
    title: profile.title || "",
    company: profile.company || "",
    email: profile.email || "",
    phone: profile.phone || "",
    website: profile.website || "",
    linkedin: profile.linkedin || "",
  };

  return (
    <main className="min-h-screen bg-slate-100 flex flex-col items-center px-5 py-12 gap-6">

      {/* Front card */}
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-xl overflow-hidden px-8 pt-8 pb-2">
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: "#1e3a6e" }}
          >
            <span
              className="text-2xl font-bold"
              style={{
                background: "linear-gradient(135deg, #60a5fa, #a78bfa)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {profile.company ? profile.company[0] : "E"}
            </span>
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{profile.company || "Evercard"}</p>
            <p className="text-xs text-gray-400">Share. Connect. Remember.</p>
          </div>
        </div>

        <div className="h-px w-full mb-6" style={{ background: "linear-gradient(to right, #60a5fa, #a78bfa)" }} />

        <h1 className="text-3xl font-bold text-gray-900 mb-1">{profile.name}</h1>
        {profile.title && (
          <p
            className="text-base font-semibold mb-6"
            style={{
              background: "linear-gradient(to right, #3b82f6, #8b5cf6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {profile.title}
          </p>
        )}

        <div className="w-full">
          {profile.phone && (
            <ContactRow href={`tel:${profile.phone}`} value={profile.phone} icon={
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
            } />
          )}
          {profile.email && (
            <ContactRow href={`mailto:${profile.email}`} value={profile.email} icon={
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.75L2.25 6.75" />
              </svg>
            } />
          )}
          {profile.website && (
            <ContactRow href={`https://${profile.website}`} value={profile.website} icon={
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253" />
              </svg>
            } />
          )}
          {profile.linkedin && (
            <ContactRow href={`https://${profile.linkedin}`} value={`@${profile.linkedin.split("/in/")[1] ?? profile.linkedin}`} icon={
              <svg fill="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            } />
          )}
        </div>

        <div className="w-full -mx-8 mt-2">
          <svg viewBox="0 0 400 80" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <defs>
              <linearGradient id="wave-light" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#c4b5fd" stopOpacity="0.8" />
              </linearGradient>
            </defs>
            <path d="M0,40 C80,0 160,70 240,40 C300,20 360,60 400,30 L400,80 L0,80 Z" fill="url(#wave-light)" />
          </svg>
        </div>
      </div>

      {/* Action buttons */}
      <div className="w-full max-w-sm flex flex-col gap-3">
        <SaveContactButton person={person} />
        {profile.linkedin && (
          <a
            href={`https://${profile.linkedin}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full border border-gray-300 text-gray-700 hover:border-blue-500 hover:text-blue-600 font-semibold py-3 px-6 rounded-full transition-colors text-sm text-center bg-white"
          >
            Connect on LinkedIn
          </a>
        )}
      </div>

      {/* Lead capture */}
      <div className="w-full max-w-sm flex items-center gap-3 my-1">
        <div className="flex-1 h-px bg-gray-300" />
        <span className="text-gray-400 text-xs">or share your info</span>
        <div className="flex-1 h-px bg-gray-300" />
      </div>
      <div className="w-full max-w-sm">
        <LeadCaptureForm cardOwner={profile.username} />
      </div>

      <p className="text-gray-400 text-xs pb-4">Powered by Evercard</p>
    </main>
  );
}
