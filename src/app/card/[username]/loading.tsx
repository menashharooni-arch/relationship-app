import { SkeletonBlockLight } from "@/components/Skeleton";

// The template isn't known until the card data loads, so this is a generic
// card-shell shape (avatar + name/title bars) rather than a specific
// template's exact layout — matches the page's cream background so there's
// no flash between themes.
export default function CardLoading() {
  return (
    <main className="min-h-screen flex flex-col items-center px-4 pt-10 pb-16 gap-5" style={{ background: "#FAF7F2" }}>
      <div className="w-full max-w-sm rounded-2xl p-6 shadow-sm flex flex-col items-center" style={{ background: "#fff", border: "1px solid #E4DDD4" }}>
        <SkeletonBlockLight className="w-20 h-20 rounded-full mb-4" />
        <SkeletonBlockLight className="h-4 w-32 mb-2" />
        <SkeletonBlockLight className="h-3 w-24 mb-6" />
        <SkeletonBlockLight className="h-9 w-full rounded-full" />
      </div>
      <SkeletonBlockLight className="w-full max-w-sm h-24 rounded-2xl" />
    </main>
  );
}
