"use client";

interface Person {
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  website: string;
  linkedin?: string;
}

export default function SaveContactButton({ person }: { person: Person }) {
  function downloadVCard() {
    const lines = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${person.name}`,
      `N:${person.name.split(" ").slice(1).join(" ")};${person.name.split(" ")[0]};;;`,
      `TITLE:${person.title}`,
      `ORG:${person.company}`,
      `EMAIL:${person.email}`,
      `TEL:${person.phone}`,
      `URL:https://${person.website}`,
    ];

    if (person.linkedin) {
      lines.push(`URL;type=LinkedIn:https://${person.linkedin}`);
    }

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
  }

  return (
    <button
      onClick={downloadVCard}
      className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold py-3 px-6 rounded-full transition-colors text-sm"
    >
      Save Contact
    </button>
  );
}
