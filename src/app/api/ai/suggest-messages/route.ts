import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getOwnerUsernames } from "@/lib/owner-usernames";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ messages: [] });
  }

  const { leadId, meetContext, tone = "friendly" } = await req.json();
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

  const adminSupabase = getAdminSupabase();
  const [{ data: profile }, { data: lead }, usernames] = await Promise.all([
    adminSupabase.from("profiles").select("name, title, company").eq("id", user.id).single(),
    adminSupabase.from("leads").select("name, phone, company, message, notes, tags, card_owner").eq("id", leadId).single(),
    getOwnerUsernames(user.id),
  ]);

  // Only the owner of the lead may generate messages for it.
  if (!lead || !usernames.includes(lead.card_owner)) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const ownerName = profile?.name ?? "I";
  const title = profile?.title ?? "";
  const company = profile?.company ?? "";
  const leadName = lead.name.split(" ")[0];

  const contextLines = [
    title && `${ownerName} works as a ${title}${company ? ` at ${company}` : ""}`,
    lead.company && `${leadName} works at ${lead.company}`,
    meetContext && `They met at: ${meetContext}`,
    lead.message && `${leadName} mentioned: "${lead.message}"`,
    lead.notes && `Notes: ${lead.notes}`,
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
        content: `Write 3 short follow-up messages from ${ownerName} to ${leadName}, who they recently connected with.

Context:
${contextLines.length > 0 ? contextLines.join("\n") : "No additional context provided."}

Tone: ${toneGuide}

Requirements:
- Each message max 2 sentences
- First person, natural — sounds like a real human wrote it, not a template
- Three different angles: (1) personal/casual check-in, (2) value or insight offer, (3) direct next step or question
- No emoji unless tone is friendly and it fits naturally
- Vary the openers — don't start with "Hi" or "Hey ${leadName}" on all three
- Do NOT mention "digital business card" or "networking"

Return ONLY valid JSON array of exactly 3 strings: ["msg1","msg2","msg3"]`,
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "[]";
    const match = text.match(/\[[\s\S]*?\]/);

    const messages: string[] = JSON.parse(match?.[0] ?? "[]");
    return NextResponse.json({ messages: messages.slice(0, 3) });
  } catch {
    return NextResponse.json({ messages: [] });
  }
}
