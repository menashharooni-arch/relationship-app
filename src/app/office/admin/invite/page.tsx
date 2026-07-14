import { redirect } from "next/navigation";

// Inviting is a button on the Team page now, not a destination. Old links
// (including "add a seat to invite" emails/bookmarks) land on the Team tab.
export default function OfficeInviteRedirect() {
  redirect("/office/admin");
}
