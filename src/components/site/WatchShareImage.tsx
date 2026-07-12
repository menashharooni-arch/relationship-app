// User-supplied photo (iPhone + Apple Watch sharing a contact) for the watch
// section.
export default function WatchShareImage() {
  return (
    <div className="relative w-full max-w-[600px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/marketing/watch-share.jpg"
        alt="Share your SwiftCard from your iPhone and Apple Watch"
        width={1298}
        height={648}
        className="w-full h-auto block rounded-2xl"
      />
    </div>
  );
}
