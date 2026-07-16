import { SkeletonBlock } from "@/components/Skeleton";

// Covers both analytics/page.tsx and analytics/[id]/page.tsx (a loading.tsx
// applies to its whole segment subtree unless a child defines a more
// specific one) — this is the heaviest fetch chain in the office/admin
// section (up to 4 parallel metrics/RPC calls), so it benefits the most from
// having its own skeleton rather than falling back to the plainer parent one.
export default function OfficeAnalyticsLoading() {
  return (
    <div>
      <SkeletonBlock className="h-6 w-32 mb-5" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 7 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-16 rounded-2xl" />
        ))}
      </div>
      <SkeletonBlock className="h-40 rounded-2xl mb-6" />
      <SkeletonBlock className="h-72 rounded-2xl" />
    </div>
  );
}
