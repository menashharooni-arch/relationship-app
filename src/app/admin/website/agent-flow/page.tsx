import SiteSubNav from "../SiteSubNav";
import AgentFlowClient from "./AgentFlowClient";

// Admin gate inherited from src/app/admin/layout.tsx (ADMIN_EMAILS only).
export const metadata = { title: "Agent Flow — SwiftCard Admin" };

export default function AgentFlowPage() {
  return (
    <>
      <SiteSubNav />
      <AgentFlowClient />
    </>
  );
}
