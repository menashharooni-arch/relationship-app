import SaveContactButton from "@/components/SaveContactButton";
import LeadCaptureForm from "@/components/LeadCaptureForm";

const person = {
  name: "Menash Harooni",
  title: "Founder",
  company: "Evercard",
  email: "menashharooni@gmail.com",
  phone: "(516) 829-0348",
  website: "relationship-app-alpha.vercel.app",
  linkedin: "linkedin.com/in/menashharooni",
};

export default function CardPage() {
  return (
    <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-5 py-14 gap-5">

      {/* The card */}
      <div className="w-full max-w-sm bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl p-8">

        {/* Top: brand label + accent dot */}
        <div className="flex items-center justify-between mb-10">
          <span className="text-[11px] font-bold tracking-[0.25em] text-gray-500 uppercase">
            {person.company}
          </span>
          <div className="w-2 h-2 rounded-full bg-blue-500" />
        </div>

        {/* Name block */}
        <div className="mb-10">
          <h1 className="text-[2rem] font-bold text-white leading-snug tracking-tight">
            {person.name.split(" ").map((word, i) => (
              <span key={i} className="block">{word}</span>
            ))}
          </h1>
          <p className="text-blue-400 text-sm font-medium mt-3 tracking-wide">
            {person.title}
          </p>
        </div>

        {/* Contact rows */}
        <div className="border-t border-gray-800 pt-6 space-y-4">
          <a href={`mailto:${person.email}`} className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors group">
            <svg className="w-4 h-4 shrink-0 text-gray-600 group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.75L2.25 6.75" />
            </svg>
            <span className="text-sm">{person.email}</span>
          </a>

          <a href={`tel:${person.phone}`} className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors group">
            <svg className="w-4 h-4 shrink-0 text-gray-600 group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
            <span className="text-sm">{person.phone}</span>
          </a>

          <a href={`https://${person.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors group">
            <svg className="w-4 h-4 shrink-0 text-gray-600 group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253M3.284 14.253A8.959 8.959 0 013 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
            <span className="text-sm">{person.website}</span>
          </a>

          <a href={`https://${person.linkedin}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors group">
            <svg className="w-4 h-4 shrink-0 text-gray-600 group-hover:text-blue-400 transition-colors" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            <span className="text-sm">{person.linkedin}</span>
          </a>
        </div>
      </div>

      {/* Primary CTA */}
      <div className="w-full max-w-sm flex flex-col gap-3">
        <SaveContactButton person={person} />
        <a
          href={`https://${person.linkedin}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full border border-gray-700 text-gray-300 hover:border-blue-500 hover:text-white font-semibold py-3 px-6 rounded-full transition-colors text-sm text-center"
        >
          Connect on LinkedIn
        </a>
      </div>

      {/* Lead capture divider */}
      <div className="w-full max-w-sm flex items-center gap-3 my-1">
        <div className="flex-1 h-px bg-gray-800" />
        <span className="text-gray-600 text-xs">or share your info</span>
        <div className="flex-1 h-px bg-gray-800" />
      </div>

      {/* Lead capture form */}
      <div className="w-full max-w-sm">
        <LeadCaptureForm cardOwner="menash" />
      </div>

      {/* Branding */}
      <p className="text-gray-700 text-xs mt-2">Powered by Evercard</p>
    </main>
  );
}
