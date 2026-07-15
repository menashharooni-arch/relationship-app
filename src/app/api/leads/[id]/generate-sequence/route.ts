import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getOwnerUsernames } from "@/lib/owner-usernames";
import { ownsLead } from "@/lib/lead-access";
import { isPaidPlan } from "@/lib/plan";
import { aiComplete } from "@/lib/ai";

type Step = { day: number; time: string };

// New cadences: Light (2), Medium (3), Aggressive (4) with specific send times.
// Legacy numeric keys kept for the dashboard LeadCard builder.
const PRESET_CADENCES: Record<string, { name: string; steps: Step[] }> = {
  light:      { name: "Light",      steps: [{ day: 1, time: "10:06" }, { day: 30, time: "13:22" }] },
  medium:     { name: "Medium",     steps: [{ day: 1, time: "10:06" }, { day: 14, time: "13:22" }, { day: 28, time: "11:45" }] },
  aggressive: { name: "Aggressive", steps: [{ day: 1, time: "10:06" }, { day: 14, time: "13:22" }, { day: 28, time: "11:45" }, { day: 56, time: "11:22" }] },
  "1": { name: "Warm Touch", steps: [1, 2, 4, 7].map((d) => ({ day: d, time: "13:00" })) },
  "2": { name: "Standard",   steps: [1, 4, 10, 21, 45].map((d) => ({ day: d, time: "13:00" })) },
  "3": { name: "Long-term",  steps: [1, 30, 90, 180, 365].map((d) => ({ day: d, time: "13:00" })) },
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { presetKey, whereMet, notes, channel } = await req.json();
  const preset = PRESET_CADENCES[presetKey];
  if (!preset) return NextResponse.json({ error: "Invalid preset" }, { status: 400 });
  const isText = channel === "sms";

  const admin = getAdminSupabase();
  const [{ data: lead }, { data: profile }, usernames] = await Promise.all([
    admin.from("leads").select("name, email, company, company_description, message, card_owner").eq("id", id).single(),
    admin.from("profiles").select("name, title, company, plan, customization").eq("id", user.id).single(),
    getOwnerUsernames(user.id),
  ]);

  if (!ownsLead(usernames, lead)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The contact belongs to a specific card — prefer THAT card's About (what the
  // user does for this audience), falling back to the profile-level About so the
  // AI always knows what the sender actually does.
  const { data: card } = await admin
    .from("cards")
    .select("customization")
    .eq("username", lead.card_owner)
    .maybeSingle();
  const about = (
    ((card?.customization as { about?: string } | null)?.about ?? "").trim() ||
    ((profile?.customization as { about?: string } | null)?.about ?? "").trim()
  );

  // Multi-day AI follow-up sequences that auto-send are a Pro/Office feature.
  if (!isPaidPlan(profile?.plan)) {
    return NextResponse.json(
      { code: "SEQUENCES_PRO_ONLY", error: "upgrade", message: "Automated follow-up sequences are a Pro feature. Upgrade to unlock them.", upgrade: "/pricing" },
      { status: 402 }
    );
  }

  const leadFirst = (lead.name as string).split(" ")[0];
  const total = preset.steps.length;

  // Generate every step's copy in parallel so even the 4-touch Aggressive preset
  // (and email+text together) returns fast and never times out.
  const sequence = await Promise.all(preset.steps.map(async ({ day, time }, i) => {
    let message = "";
    let subject = "";

    const stepGoal =
      i === 0
        ? "This is the FIRST touch, right after meeting. Reference where/how you met and why it was genuinely good to connect. Warm and specific — no pitch."
        : i === total - 1
        ? "This is the LAST touch. Gracefully leave the door open without pressure. Keep it short and human."
        : "A light, genuine check-in that keeps the relationship warm and offers a little value. Not salesy.";

    const prompt = `You are ${profile?.name ?? "the sender"}${profile?.title ? `, a ${profile.title}` : ""}${profile?.company ? ` at ${profile.company}` : ""}. You are personally writing a follow-up ${isText ? "TEXT MESSAGE" : "EMAIL"} to someone you recently met. Write it exactly the way a thoughtful real person would — natural, warm, specific. It must never read like a template or a marketing blast.

WHAT YOU DO (so you know what you can genuinely help them with — do NOT paste this in verbatim):
${about || "(not provided — keep it human and general, don't invent specifics about your work)"}

WHO YOU ARE WRITING TO:
- Name: ${leadFirst}${lead.company ? `, who is at ${lead.company}` : ""}
- Where/how you met: ${whereMet || "(not noted)"}
- Your private notes about them: ${notes || "(none provided)"}
${(lead as { company_description?: string }).company_description ? `- About their business: ${(lead as { company_description?: string }).company_description}` : ""}
${lead.message ? `- Something they told you: "${lead.message}"` : ""}

THIS MESSAGE: Day ${day} of a ${total}-message ${preset.name} sequence. ${stepGoal}

HARD RULES:
- Pull in a real, specific detail from "where you met" or your notes whenever you have one — that is what makes it feel human. If notes are sparse, stay natural and DO NOT invent facts about them.
- No "Hey there", no "I hope this email finds you well", no buzzwords, no corporate filler, and never say "digital business card".
- First person, from you to ${leadFirst}. Do not put their name on its own greeting line, and do NOT add any sign-off or signature — your name, company and SwiftCard link are attached automatically below.
${isText
        ? `- Under 160 characters, plain conversational text. Return ONLY the message text — nothing else.`
        : `- 2 to 4 short sentences. A real email: you may use a blank line between thoughts so it breathes. Write a natural, low-key subject line (max 6 words, no clickbait, no ALL CAPS).
- Return ONLY JSON: {"subject":"...","message":"..."}`}`;

    // A provider hiccup must never 500 the whole request — the canned fallback
    // copy below keeps the flow working, and the user can Regenerate.
    let raw = "";
    try {
      raw = (await aiComplete(prompt, { maxTokens: 300, json: !isText })) ?? "";
    } catch {
      raw = "";
    }
    if (raw) {
      if (isText) {
        message = raw;
      } else {
        const m = raw.match(/\{[\s\S]*\}/);
        try {
          const p = JSON.parse(m?.[0] ?? "{}");
          message = (p.message || "").trim();
          subject = (p.subject || "").trim();
        } catch { message = raw; }
      }
    }

    if (!message) {
      message = day === 1
        ? `It was great connecting with you! I wanted to make sure you have my details — feel free to reach out anytime.`
        : `Just checking in — hope things have been going well. Let me know if there's anything I can help with.`;
    }
    if (!isText && !subject) subject = day === 1 ? "Great connecting" : "Checking in";

    // Stamp the channel on every step — the cron routes strictly by it, and the
    // per-contact email/text toggles pause exactly their own channel.
    return { day, time, message, subject: subject || undefined, channel: isText ? ("sms" as const) : ("email" as const) };
  }));

  return NextResponse.json({ sequence });
}
