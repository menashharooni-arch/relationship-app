import type { ComponentType } from "react";
import { createClient } from "@/lib/supabase-server";
import NewCardWizard from "./NewCardWizard";
import GuestDraftClaim from "@/components/GuestDraftClaim";

// NewCardWizard gains a `guest?: boolean` prop (owned by the card-editor agent).
// Forward-declare it here so this wrapper can pass guest mode before/after that
// change lands — the real optional prop satisfies this type.
const Wizard = NewCardWizard as ComponentType<{ isPro: boolean; guest?: boolean }>;

// Guests may build a full card here WITHOUT an account — no login wall while
// editing. Auth is required only for protected actions (publish / save / share /
// QR / signature / analytics / leads), which the wizard gates via requireAuth.
// When a signed-in user lands here with a pending guest draft, GuestDraftClaim
// converts it into a real card and moves them into the editor.
export default async function NewCardPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string; claim?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Two very different intents share this route:
  //  • `?add=1` — a SIGNED-IN user adding another card to THEIR account (linked
  //    from the dashboard). Build straight into the current account.
  //  • anything else — the marketing "Get started / Create your free card" entry.
  //    This is a NEW-account flow: even if a session happens to be in the browser
  //    (e.g. a returning user), the card must NOT silently merge into that
  //    account. The visitor builds as a guest and explicitly chooses an account
  //    (log in, or sign up with a different email) before it's saved.
  const authedAdd = sp.add === "1" && !!user;

  let isPro = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();
    isPro = profile?.plan === "pro" || profile?.plan === "enterprise";
  }

  // The pending draft is claimed ONLY on `claim=1` — the post-auth return from
  // the account gate (GuestGateModal stamps it on the redirect URL), i.e. the
  // visitor just chose an account for THIS draft. GuestDraftClaim additionally
  // verifies the draft carries fresh gate consent before posting it.
  // Deliberately NOT on `add=1`: a signed-in user clicking "Add Card" expects a
  // blank wizard — a leftover guest draft from an earlier visit (possibly built
  // for a different account) must never silently merge in.
  const claimHere = !!user && sp.claim === "1";

  return (
    <>
      {claimHere && <GuestDraftClaim />}
      <Wizard isPro={isPro} guest={!authedAdd} />
    </>
  );
}
