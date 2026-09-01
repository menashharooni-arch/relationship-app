import AgentFlowClient from "./AgentFlowClient";

// Admin gate inherited from src/app/admin/layout.tsx (ADMIN_EMAILS only).
// Top-level admin tab (right of Sandbox) — owner order 2026-09-01: Agent Flow
// is its own thing, not part of the Website analytics section.
export const metadata = { title: "Agent Flow — SwiftCard Admin" };

export default function AgentFlowPage() {
  return <AgentFlowClient />;
}
