import { cookies } from "next/headers";
import WebsiteAnalyticsClient from "./WebsiteAnalyticsClient";

// Admin gate is inherited from src/app/admin/layout.tsx (ADMIN_EMAILS only).
export const metadata = { title: "Website analytics — SwiftCard" };

export default async function AdminWebsitePage() {
  // Read the current device's internal flag so the toggle shows the right state
  // on first paint.
  const internalNow = (await cookies()).get("sc_internal")?.value === "1";
  return <WebsiteAnalyticsClient initialInternalDevice={internalNow} />;
}
