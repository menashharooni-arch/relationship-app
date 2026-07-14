import { redirect } from "next/navigation";

// The team admin console lives at /office/admin (reached from the "Admin" nav
// item, right of Settings). /office is kept as a permanent redirect so older
// links, bookmarks and emails still land in the right place.
export default function OfficePage() {
  redirect("/office/admin");
}
