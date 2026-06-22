import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-100 flex flex-col">

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-4xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#1e3a6e" }}>
            <span className="text-sm font-bold" style={{ background: "linear-gradient(135deg, #60a5fa, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>E</span>
          </div>
          <span className="font-bold text-gray-900">Evercard</span>
        </div>
        <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
          Sign in
        </Link>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
        <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-1.5 text-xs text-gray-500 font-medium mb-8 shadow-sm">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          Free to start — no credit card needed
        </div>

        <h1 className="text-5xl font-bold text-gray-900 leading-tight max-w-lg mb-6">
          Your digital business card.{" "}
          <span style={{ background: "linear-gradient(to right, #3b82f6, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Share instantly.
          </span>
        </h1>

        <p className="text-gray-500 text-lg max-w-md mb-10">
          Share your card by QR code, link, or tap. Anyone can save your contact without downloading an app. You capture every lead automatically.
        </p>

        <Link
          href="/login"
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-4 rounded-full text-base transition-colors shadow-lg shadow-blue-200"
        >
          Get your free card →
        </Link>

        <p className="text-gray-400 text-xs mt-4">Takes 60 seconds to set up</p>
      </section>

      {/* Features */}
      <section className="max-w-4xl mx-auto w-full px-6 pb-20 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: "📇", title: "Save to contacts", body: "One tap saves your info directly to their phone's contacts. No app needed." },
          { icon: "📥", title: "Capture leads", body: "When someone shares their info back, it lands instantly in your dashboard." },
          { icon: "🗒️", title: "Remember everything", body: "Add notes to every lead — where you met, what you talked about, next steps." },
        ].map((f) => (
          <div key={f.title} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <p className="text-3xl mb-3">{f.icon}</p>
            <p className="font-semibold text-gray-900 mb-1">{f.title}</p>
            <p className="text-gray-500 text-sm">{f.body}</p>
          </div>
        ))}
      </section>

      <footer className="text-center pb-8 text-gray-400 text-xs">
        © {new Date().getFullYear()} Evercard
      </footer>
    </main>
  );
}
