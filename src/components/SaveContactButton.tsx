"use client";

interface Person {
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  website: string;
}

export default function SaveContactButton({ person }: { person: Person }) {
  function downloadVCard() {
    const vcard = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${person.name}`,
      `N:${person.name.split(" ").slice(1).join(" ")};${person.name.split(" ")[0]};;;`,
      `TITLE:${person.title}`,
      `ORG:${person.company}`,
      `EMAIL:${person.email}`,
      `TEL:${person.phone}`,
      `URL:https://${person.website}`,
      "END:VCARD",
    ].join("\r\n");

    const blob = new Blob([vcard], { type: "text/vcard;charset=utf-8" });
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
      className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-3 px-6 rounded-full transition-colors text-base"
    >
      Save Contact
    </button>
  );
}
