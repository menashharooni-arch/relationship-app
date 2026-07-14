import { redirect } from "next/navigation";

// Cards are managed from each person's page now (Team → person → card).
// Old bookmarks land on the Team tab; /cards/[id] detail still resolves.
export default function OfficeCardsRedirect() {
  redirect("/office/admin");
}
