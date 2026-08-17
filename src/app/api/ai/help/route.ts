import { aiComplete, hasAiProvider } from "@/lib/ai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { isRateLimited } from "@/lib/rate-limit";
import { aiConsentAllowsFor } from "@/lib/ai-consent-server";
import { KNOWLEDGE } from "@/lib/knowledge";
import { buildPrompt, instantAnswer, type Scope } from "@/lib/knowledge/retrieval";
import {
  APP_PERSONA,
  OFFICE_ADMIN_PERSONA,
  NATIVE_RULES,
  APP_FALLBACK,
  NATIVE_FALLBACK,
  OFFICE_ADMIN_FALLBACK,
  OFFICE_ADMIN_NATIVE_FALLBACK,
} from "@/lib/knowledge/personas";

// The in-app assistant. It carries NO product knowledge of its own — everything
// it says comes from src/lib/knowledge, which is shared with the marketing
// assistant and kept honest by tests/knowledge-truth.test.ts. This file is a
// transport: authenticate, rate-limit, pick the audience, answer.
//
// Two answer paths, unchanged in spirit from the original: a strong trigger
// match returns a written answer instantly and for free, and anything else goes
// to the LLM with the corpus injected as grounding.

export { NATIVE_RULES, NATIVE_FALLBACK };

type ChatMessage = { role: "user" | "assistant"; content: string };

/**
 * Kept as a named export because tests/help-guardrail.test.ts pins the native
 * guardrail through this exact seam. The `kb` parameter is gone — there is one
 * corpus now — but the (question, native) contract is identical.
 */
export function localAnswer(question: string, native = false, area: Scope["audience"] = "user"): string | null {
  return instantAnswer(KNOWLEDGE, question, { audience: area, native });
}

/** Same: the prompt-construction seam the guardrail test asserts against. */
export function buildHelpPrompt(convo: string, native = false, persona: string = APP_PERSONA): string {
  // The last user line is what ranks the corpus; the whole conversation is
  // still handed to the model for context.
  const lastUser = convo.split("\n").reverse().find((l) => l.startsWith("User: ")) ?? convo;
  return buildPrompt({
    corpus: KNOWLEDGE,
    persona,
    convo,
    question: lastUser.replace(/^User: /, ""),
    scope: { audience: persona === OFFICE_ADMIN_PERSONA ? "office-admin" : "user", native },
    extraRules: native ? NATIVE_RULES : "",
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Per-user throttle: authenticated but previously uncapped (cost/abuse guard).
  if (await isRateLimited(`ai-help:${user.id}`, 30, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests — please wait a moment and try again." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const native = body.native === true;
  // `area` scopes the assistant. "office-admin" gets the console persona and
  // the console's docs; every other value is the default app assistant.
  const isAdmin = body.area === "office-admin";
  const scope: Scope = { audience: isAdmin ? "office-admin" : "user", native };
  const persona = isAdmin ? OFFICE_ADMIN_PERSONA : APP_PERSONA;
  const fallback = isAdmin
    ? (native ? OFFICE_ADMIN_NATIVE_FALLBACK : OFFICE_ADMIN_FALLBACK)
    : (native ? NATIVE_FALLBACK : APP_FALLBACK);

  const raw = Array.isArray(body.messages) ? body.messages : [];
  const messages: ChatMessage[] = raw
    .filter((m: unknown): m is ChatMessage =>
      !!m && typeof m === "object" &&
      ((m as ChatMessage).role === "user" || (m as ChatMessage).role === "assistant") &&
      typeof (m as ChatMessage).content === "string")
    .slice(-12)
    .map((m: ChatMessage) => ({ role: m.role, content: m.content.slice(0, 2000) }));

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return NextResponse.json({ error: "No question provided." }, { status: 400 });

  // 1) Answer instantly from the knowledge base (free, always works).
  //    Native sessions get the native-safe answer for any commerce doc.
  const local = instantAnswer(KNOWLEDGE, lastUser.content, scope);
  if (local) return NextResponse.json({ reply: local });

  // 2) Otherwise ask the LLM, grounded in the same corpus, IF a provider is
  //    configured AND the account hasn't refused AI. A declined account keeps a
  //    working assistant — it just answers from the corpus above and the
  //    fallback below, and its message never leaves for the provider.
  if (hasAiProvider() && (await aiConsentAllowsFor(user.id))) {
    const convo = messages.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n");
    const prompt = buildPrompt({
      corpus: KNOWLEDGE,
      persona,
      convo,
      question: lastUser.content,
      scope,
      extraRules: native ? NATIVE_RULES : "",
    });
    const reply = await aiComplete(prompt, { maxTokens: 700 });
    if (reply) return NextResponse.json({ reply });
  }

  return NextResponse.json({ reply: fallback });
}
