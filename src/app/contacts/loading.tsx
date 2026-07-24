import PortalSkeleton from "@/components/PortalSkeleton";

// Shown instantly on navigation to /contacts while the server renders.
export default function Loading() {
  return <PortalSkeleton />;
}
