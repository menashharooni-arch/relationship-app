import { SkeletonBlock } from "@/components/Skeleton";

export default function ContactsLoading() {
  return (
    <div className="sc-app min-h-screen bg-gray-950 flex flex-col pb-16 md:pb-0">
      <div className="pt-[57px] border-b border-gray-800 px-6 py-5 bg-gray-950">
        <SkeletonBlock className="h-6 w-28" />
      </div>
      <div className="px-6 py-5 space-y-3">
        <SkeletonBlock className="h-14 rounded-xl" />
        <SkeletonBlock className="h-14 rounded-xl" />
        <SkeletonBlock className="h-14 rounded-xl" />
        <SkeletonBlock className="h-14 rounded-xl" />
      </div>
    </div>
  );
}
