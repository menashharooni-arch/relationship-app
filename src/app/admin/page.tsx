import OverviewClient from "./OverviewClient";

// Admin gate lives in the /admin layout.
export const metadata = { title: "Admin — SwiftCard" };

export default function AdminPage() {
  return <OverviewClient />;
}
