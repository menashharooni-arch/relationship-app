import Link from "next/link";
import OfficeAdminNav from "./OfficeAdminNav";
import AdminGuidedTour from "@/components/office/AdminGuidedTour";
import { requireOfficeAdmin } from "@/lib/office-admin-guard";

// Every /office/admin page inherits this shell: the Office gate + one consistent
// nav, so each area is a proper page instead of one crammed scroll.
//
// Deliberately mirrors the site-owner console's shell, but is a DIFFERENT thing:
// this is the team's own admin, gated on Office membership. /admin is
// ADMIN_EMAILS-only and office users must never reach it — nothing here links there.
export default async function OfficeAdminLayout({ children }: { children: React.ReactNode }) {
  const { office } = await requireOfficeAdmin();
  const officeName = (office?.name as string) ?? "Your team";

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top accent stripe */}
      <div className="fixed top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-600 via-violet-500 to-blue-400 z-50" />

      <header className="sticky top-0 z-40 bg-gray-950/90 backdrop-blur border-b border-gray-800/80">
        <div className="max-w-6xl mx-auto px-5">
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center gap-3 min-w-0">
              <Link href="/office/admin" className="flex items-center gap-2 shrink-0 min-w-0">
                <span className="text-[10px] font-bold tracking-[0.25em] text-slate-500 uppercase shrink-0">SwiftCard</span>
                <span className="text-xs font-bold bg-purple-600/20 border border-purple-500/30 text-purple-300 px-2 py-0.5 rounded-full shrink-0">Admin</span>
                <span className="text-xs text-gray-500 truncate hidden sm:block">{officeName}</span>
              </Link>
            </div>
            <Link href="/dashboard" className="text-xs text-gray-500 hover:text-white transition-colors shrink-0">
              ← My dashboard
            </Link>
          </div>
          <OfficeAdminNav />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 pt-6 pb-16">{children}</main>
      <AdminGuidedTour />
    </div>
  );
}
