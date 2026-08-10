import PortalSkeleton from "@/components/PortalSkeleton";

// Shown instantly on navigation within the Office admin console.
// bubble="purple": the console's assistant bubble is purple, not blue.
export default function Loading() {
  return <PortalSkeleton bubble="purple" />;
}
