// The watch visual — the same photo on every screen size. Phones used to get a
// code-rendered watch face instead (the photo's details shrink at column
// width), but showing different content per device made the phone site diverge
// from the desktop site (owner rule: phone and computer must match, desktop is
// the source of truth). One asset, one story, everywhere.
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
