import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getOwnerUsernames } from "@/lib/owner-usernames";
import { isPaidPlan } from "@/lib/plan";
import Anthropic from "@anthropic-ai/sdk";

const PRESET_CADENCES: Record<string, { name: string; days: number[] }> = {
  "1": { name: "Warm Touch",  days: [1, 2, 4, 7] },
  "2": { name: "Standard",    days: [1, 4, 10, 21, 45] },
  "3": { name: "Long-term",   days: [1, 30, 90, 180, 365] },
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { presetKey, whereMet, convoDetails } = await req.json();
  const preset = PRESET_CADENCES[presetKey];
  if (!preset) return NextResponse.json({ error: "Invalid preset" }, { status: 400 });

  const admin = getAdminSupabase();
  const [{ data: lead }, { data: profile }, usernames] = await Promise.all([
    admin.from("leads").select("name, email, company, company_description, message, card_owner").eq("id", id).single(),
    admin.from("profiles").select("name, title, company, plan, customization").eq("id", user.id).single(),
    getOwnerUsernames(user.id),
  ]);

  if (!lead || !usernames.includes(lead.card_owner)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const about = ((profile?.customization as { about?: string } | null)?.about ?? "").trim();

  // Multi-day AI follow-up sequences are a Pro/Office feature.
  if (!isPaidPlan(profile?.plan)) {
    return NextResponse.json(
      { error: "upgrade", message: "Automated follow-up sequences are a Pro feature. Upgrade to unlock them.", upgrade: "/pricing" },
      { status: 402 }
    );
  }

  const anthropic = process.env.ANTHROPIC_API_KEY
    ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    : null;

  const sequence: { day: number; message: string }[] = [];
  const totalDays = preset.days.length;

  for (let i = 0; i < totalDays; i++) {
    const day = preset.days[i];
    let message = "";

    if (anthropic) {
      try {
        const isFirst = i === 0;
        const isLast = i === totalDays - 1;
        const tone = isFirst ? "warm and immediate" : isLast ? "graceful close" : "brief check-in";

        const resp = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 200,
          messages: [{
            role: "user",
            content: `Write a short personal follow-up email body (2-3 sentences) for Day ${day} of a ${preset.name} follow-up sequence.

Sender: ${profile?.name ?? ""}${profile?.title ? `, ${profile.title}` : ""}${profile?.company ? ` at ${profile.company}` : ""}
${about ? `What the sender does/offers (their About — speak to the right things): ${about}` : ""}
${(lead as { company_description?: string }).company_description ? `Business context: ${(lead as { company_description?: string }).company_description}` : ""}
Recipient first name: ${(lead.name as string).split(" ")[0]}${lead.company ? ` (${lead.company})` : ""}
${whereMet ? `Where met: ${whereMet}` : ""}
${convoDetails ? `Context: ${convoDetails}` : ""}
${lead.message ? `Their note: "${lead.message}"` : ""}

Tone: ${tone}. Day ${day} of ${totalDays}-part sequence.
Rules: 2-3 sentences max. First person. No "Hey" opener. No mention of "digital business card". No subject line or sign-off. Return only the body text.`,
          }],
        });
        message = resp.content[0].type === "text" ? (resp.content[0].text as string).trim() : "";
      } catch { /* fall through */ }
    }

    if (!message) {
      message = day === 1
        ? `It was great connecting with you! I wanted to make sure you have my details — feel free to reach out anytime.`
        : `Just checking in — hope things have been going well. Let me know if there's anything I can help with.`;
    }

    sequence.push({ day, message });
  }

  return NextResponse.json({ sequence });
}
