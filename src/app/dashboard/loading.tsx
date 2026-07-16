import { SkeletonBlock } from "@/components/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-950 px-5 py-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <SkeletonBlock className="h-8 w-32" />
        <SkeletonBlock className="h-8 w-8 rounded-full" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SkeletonBlock className="h-72 rounded-2xl" />
        <div className="space-y-4">
          <SkeletonBlock className="h-24 rounded-2xl" />
          <SkeletonBlock className="h-24 rounded-2xl" />
          <SkeletonBlock className="h-24 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
