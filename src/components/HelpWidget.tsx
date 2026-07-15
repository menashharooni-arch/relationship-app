"use client";

import { useEffect, useRef, useState } from "react";
import { isNativeApp } from "@/lib/platform";

type Msg = { role: "user" | "assistant"; content: string };

const GREETING: Msg = {
  role: "assistant",
  content:
    "Hi! I'm your SwiftCard assistant. Ask me where to find something or how to do it — e.g. \"How do I create a card?\", \"Where do I change my design?\", or \"How do I upgrade to Pro?\"",
};

const SUGGESTIONS = [
  "How do I create a card?",
  "Where do I change my card design?",
  "How do I share my card?",
  "How do I upgrade to Pro?",
];

// Two presentations of the same assistant:
//   default  — the full-width "Need help?" button used inline on Settings.
//   floating — a chatbot bubble pinned bottom-right on app pages (sits above
//              the mobile bottom nav; the open panel overlays it).
export default function HelpWidget({ floating = false }: { floating?: boolean }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, loading]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || loading) return;
    const next = [...messages, { role: "user" as const, content: question }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/ai/help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Skip the static greeting when sending history. The `native` flag lets
        // the server apply the in-app guardrail (no pricing/upgrade/website).
        body: JSON.stringify({ messages: next.slice(1), native: isNativeApp }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply || "Sorry, I couldn't answer that." }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry — something went wrong. Try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Trigger — floating chatbot bubble, or the inline Settings button */}
      {floating ? (
        !open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            title="Chat with the SwiftCard assistant"
            aria-label="Open chat assistant"
            className="fixed bottom-20 md:bottom-5 right-4 z-40 rounded-full bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/40 flex items-center justify-center transition-all hover:scale-105"
            style={{ width: 52, height: 52 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.9} className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
          </button>
        )
      ) : (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-2xl py-3 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M12 17h.008v.008H12V17z" />
            <circle cx="12" cy="12" r="9" />
          </svg>
          Need help? Ask the assistant
        </button>
      )}

      {/* Chat bubble */}
      {open && (
        <div className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm flex flex-col rounded-2xl border border-gray-700 bg-gray-950 shadow-2xl overflow-hidden" style={{ height: "min(70vh, 560px)" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M12 17h.008v.008H12V17z" />
                </svg>
              </div>
              <div>
                <p className="text-white text-sm font-semibold leading-none">SwiftCard Help</p>
                <p className="text-gray-500 text-[11px] mt-0.5">Ask anything about the app</p>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-gray-500 hover:text-white text-xl leading-none">
              ×
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                    m.role === "user" ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-200"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {/* Suggestion chips (only before the first question) */}
            {messages.length === 1 && !loading && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="text-[11px] text-gray-300 bg-gray-800/60 hover:bg-gray-700 border border-gray-700 rounded-full px-2.5 py-1 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-800 text-gray-400 rounded-2xl px-3.5 py-2.5 text-sm">Thinking…</div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="border-t border-gray-800 p-3 flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              className="flex-1 bg-gray-900 border border-gray-700 text-white placeholder-gray-600 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="shrink-0 w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 flex items-center justify-center transition-colors"
              aria-label="Send"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
