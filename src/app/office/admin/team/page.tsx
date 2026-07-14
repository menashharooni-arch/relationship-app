import { redirect } from "next/navigation";

// The Team table IS the admin landing page now. Old bookmarks land there.
// Person detail pages under /team/[id] still resolve normally.
export default function OfficeTeamRedirect() {
  redirect("/office/admin");
}
