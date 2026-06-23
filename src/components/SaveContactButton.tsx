"use client";

import { useState } from "react";

interface Person {
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  website: string;
  linkedin?: string;
  instagram?: string;
  twitter?: string;
  tiktok?: string;
}

function normalizeUrl(url: string): string {
  if (!url) return "";
  return url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
}

export default function SaveContactButton({ person }: { person: Person }) {
  const [saved, setSaved] = useState(false);

  function downloadVCard() {
    const lines = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${person.name}`,
      `N:${person.name.split(" ").slice(1).join(" ")};${person.name.split(" ")[0]};;;`,
    ];

    if (person.title)   lines.push(`TITLE:${person.title}`);
    if (person.company) lines.push(`ORG:${person.company}`);
    if (person.email)   lines.push(`EMAIL:${person.email}`);
    if (person.phone)   lines.push(`TEL:${person.phone}`);
    if (person.website) lines.push(`URL:${normalizeUrl(person.website)}`);

    if (person.linkedin)  lines.push(`URL;type=LinkedIn:${normalizeUrl(person.linkedin)}`);
    if (person.instagram) lines.push(`X-SOCIALPROFILE;type=instagram:${person.instagram.replace(/^@/, "")}`);
    if (person.twitter)   lines.push(`X-SOCIALPROFILE;type=twitter:${person.twitter.replace(/^@/, "")}`);
    if (person.tiktok)    lines.push(`X-SOCIALPROFILE;type=tiktok:${person.tiktok.replace(/^@/, "")}`);

    lines.push("END:VCARD");

    const blob = new Blob([lines.join("\r\n")], { type: "text/vcard;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${person.name.replace(/ /g, "_")}.vcf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSaved(true);
  }

  if (saved) {
    return (
      <div className="w-full bg-green-50 border border-green-200 text-green-700 font-semibold py-3 px-6 rounded-full text-sm flex items-center justify-center gap-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Saved to Contacts!
      </div>
    );
  }

  return (
    <button
      onClick={downloadVCard}
      className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-3 px-6 rounded-full transition-colors text-sm flex items-center justify-center gap-2"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
      Save Contact
    </button>
  );
}
