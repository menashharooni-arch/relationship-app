import { SkeletonBlock } from "@/components/Skeleton";

// office/admin/layout.tsx already provides the bg-gray-950 shell + header, so
// this is just the content-area skeleton, not a full-page wrapper.
export default function OfficeAdminLoading() {
  return (
    <div>
      <SkeletonBlock className="h-6 w-40 mb-5" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <SkeletonBlock className="h-16 rounded-2xl" />
        <SkeletonBlock className="h-16 rounded-2xl" />
        <SkeletonBlock className="h-16 rounded-2xl" />
        <SkeletonBlock className="h-16 rounded-2xl" />
      </div>
      <SkeletonBlock className="h-64 rounded-2xl" />
    </div>
  );
}
