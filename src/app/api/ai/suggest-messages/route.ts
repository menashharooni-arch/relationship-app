import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getOwnerUsernames } from "@/lib/owner-usernames";
import { PLAN_LIMITS, isPaidPlan } from "@/lib/plan";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ messages: [] });
  }

  const { leadId, meetContext, tone = "friendly", channel = "email" } = await req.json();
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });
  const isText = channel === "sms";

  const adminSupabase = getAdminSupabase();
  const [{ data: profile }, { data: lead }, usernames] = await Promise.all([
    adminSupabase.from("profiles").select("name, title, company, plan, customization").eq("id", user.id).single(),
    adminSupabase.from("leads").select("name, phone, company, message, notes, tags, card_owner").eq("id", leadId).single(),
    getOwnerUsernames(user.id),
  ]);

  // Only the owner of the lead may generate messages for it.
  if (!lead || !usernames.includes(lead.card_owner)) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  // Free plan gets a limited "taste" of AI drafts; Pro/Office are unlimited.
  const paid = isPaidPlan(profile?.plan);
  const usedDrafts = ((profile?.customization as { _aiDrafts?: number } | null)?._aiDrafts) ?? 0;
  if (!paid && usedDrafts >= PLAN_LIMITS.FREE_AI_DRAFT_LIMIT) {
    return NextResponse.json(
      {
        error: "upgrade",
        message: `You've used your ${PLAN_LIMITS.FREE_AI_DRAFT_LIMIT} free AI drafts. Upgrade to Pro for unlimited AI follow-ups and automated sequences.`,
        upgrade: "/pricing",
        messages: [],
      },
      { status: 402 }
    );
  }

  const ownerName = profile?.name ?? "I";
  const title = profile?.title ?? "";
  const company = profile?.company ?? "";
  const about = ((profile?.customization as { about?: string } | null)?.about ?? "").trim();
  const leadName = lead.name.split(" ")[0];

  const contextLines = [
    title && `${ownerName} works as a ${title}${company ? ` at ${company}` : ""}`,
    about && `What ${ownerName} does / offers (their About): ${about}`,
    lead.company && `${leadName} works at ${lead.company}`,
    meetContext && `They met at: ${meetContext}`,
    lead.message && `${leadName} mentioned: "${lead.message}"`,
    lead.notes && `Notes about ${leadName}: ${lead.notes}`,
  ].filter(Boolean);

  const toneGuide =
    tone === "professional" ? "Professional and polished, but still warm. No slang."
    : tone === "direct" ? "Direct and action-oriented. Short. Clear ask or next step."
    : "Warm, conversational, like texting a new friend.";

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{
        role: "user",
        content: `Write 3 short follow-up ${isText ? "TEXT MESSAGES (SMS)" : "EMAILS"} from ${ownerName} to ${leadName}, who they recently connected with.

${isText
  ? "Format: SMS. Each under 160 characters, plain text, no greeting line, no signature, no links unless essential."
  : "Format: short email body. 2-3 sentences each, no subject line and NO signature/sign-off (a signature is added automatically)."}

Context (use it to speak about the RIGHT things — naturally reference what ${ownerName} does/offers and the contact's situation):
${contextLines.length > 0 ? contextLines.join("\n") : "No additional context provided."}

Tone: ${toneGuide}

Requirements:
- ${isText ? "Each text 1-2 short sentences, under 160 characters" : "Each email max 2-3 sentences"}
- First person, natural — sounds like a real human wrote it, not a template
- Three different angles: (1) personal/casual check-in, (2) value or insight tied to what ${ownerName} does, (3) direct next step or question
- No emoji unless tone is friendly and it fits naturally
- Vary the openers — don't start with "Hi" or "Hey ${leadName}" on all three
- Do NOT mention "digital business card" or "networking"
${isText ? "" : `- Also write ONE short, specific email subject line (under 6 words, not salesy).`}

Return ONLY valid JSON: ${isText ? `{"messages":["m1","m2","m3"]}` : `{"subject":"...","messages":["m1","m2","m3"]}`}`,
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "{}";
    const match = text.match(/\{[\s\S]*\}/);
    let parsed: { subject?: string; messages?: string[] } = {};
    try { parsed = JSON.parse(match?.[0] ?? "{}"); } catch { parsed = {}; }
    const out = Array.isArray(parsed.messages) ? parsed.messages.slice(0, 3) : [];
    const subject = isText ? null : (typeof parsed.subject === "string" ? parsed.subject.trim() : null);

    // Count this draft against the Free taste limit.
    if (!paid && out.length > 0) {
      await adminSupabase
        .from("profiles")
        .update({ customization: { ...(profile?.customization ?? {}), _aiDrafts: usedDrafts + 1 } })
        .eq("id", user.id);
    }

    return NextResponse.json({
      messages: out,
      subject,
      aiDraftsRemaining: paid ? null : Math.max(0, PLAN_LIMITS.FREE_AI_DRAFT_LIMIT - (usedDrafts + 1)),
    });
  } catch {
    return NextResponse.json({ messages: [] });
  }
}
