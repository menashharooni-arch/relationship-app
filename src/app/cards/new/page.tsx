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
export default async function NewCardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let isPro = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();
    isPro = profile?.plan === "pro" || profile?.plan === "enterprise";
  }

  return (
    <>
      {user && <GuestDraftClaim />}
      <Wizard isPro={isPro} guest={!user} />
    </>
  );
}
