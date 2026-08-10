import PortalSkeleton from "@/components/PortalSkeleton";

// Shown instantly on navigation to Settings while the server renders.
// bubble=false: Settings uses the inline "Need help?" widget, not the floating
// bubble — a stand-in here would appear and then vanish.
export default function Loading() {
  return <PortalSkeleton bubble={false} />;
}
