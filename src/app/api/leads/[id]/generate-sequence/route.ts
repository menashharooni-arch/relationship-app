import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getOwnerUsernames } from "@/lib/owner-usernames";
import { isPaidPlan } from "@/lib/plan";
import Anthropic from "@anthropic-ai/sdk";

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

  if (!lead || !usernames.includes(lead.card_owner)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const about = ((profile?.customization as { about?: string } | null)?.about ?? "").trim();

  // Multi-day AI follow-up sequences that auto-send are a Pro/Office feature.
  if (!isPaidPlan(profile?.plan)) {
    return NextResponse.json(
      { error: "upgrade", message: "Automated follow-up sequences are a Pro feature. Upgrade to unlock them.", upgrade: "/pricing" },
      { status: 402 }
    );
  }

  const anthropic = process.env.ANTHROPIC_API_KEY
    ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    : null;

  const leadFirst = (lead.name as string).split(" ")[0];
  const sequence: { day: number; time: string; message: string; subject?: string }[] = [];
  const total = preset.steps.length;

  for (let i = 0; i < total; i++) {
    const { day, time } = preset.steps[i];
    let message = "";
    let subject = "";

    if (anthropic) {
      try {
        const tone = i === 0 ? "warm and immediate" : i === total - 1 ? "graceful close" : "brief check-in";
        const resp = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 220,
          messages: [{
            role: "user",
            content: `Write a short personal follow-up ${isText ? "TEXT MESSAGE (SMS, under 160 characters, plain text)" : "EMAIL body (2-3 sentences)"} for Day ${day} of a ${preset.name} follow-up sequence.

Sender: ${profile?.name ?? ""}${profile?.title ? `, ${profile.title}` : ""}${profile?.company ? ` at ${profile.company}` : ""}
${about ? `What the sender does/offers (their About — speak to the right things): ${about}` : ""}
${(lead as { company_description?: string }).company_description ? `Business context: ${(lead as { company_description?: string }).company_description}` : ""}
Recipient first name: ${leadFirst}${lead.company ? ` (${lead.company})` : ""}
${whereMet ? `Where met: ${whereMet}` : ""}
${notes ? `Notes about them: ${notes}` : ""}
${lead.message ? `Their note: "${lead.message}"` : ""}

Tone: ${tone}. Day ${day} of ${total}-part sequence.
Rules: ${isText ? "Under 160 characters, plain text, no greeting/signature, no links unless essential." : "2-3 sentences max, no greeting line, no sign-off/signature (a signature is added automatically)."} First person. No "Hey" opener. No mention of "digital business card".
${isText ? "Return only the message text." : `Also write a short subject line (under 6 words). Return ONLY JSON: {"subject":"...","message":"..."}`}`,
          }],
        });
        const raw = resp.content[0].type === "text" ? (resp.content[0].text as string).trim() : "";
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
      } catch { /* fall through */ }
    }

    if (!message) {
      message = day === 1
        ? `It was great connecting with you! I wanted to make sure you have my details — feel free to reach out anytime.`
        : `Just checking in — hope things have been going well. Let me know if there's anything I can help with.`;
    }
    if (!isText && !subject) subject = day === 1 ? "Great connecting" : "Checking in";

    sequence.push({ day, time, message, subject: subject || undefined });
  }

  return NextResponse.json({ sequence });
}
