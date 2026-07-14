import WatchScene from "@/components/site/WatchScene";

// The watch visual, picked per screen size.
//
// The photo is a 1298×648 landscape shot of an iPhone + Apple Watch. It reads
// well on a wide screen, but on a phone it scales to the column width — roughly
// 195px tall — and the watch inside it becomes a thumbnail: the QR is mush and
// the name is illegible, which is the whole point of the section. So phones get
// the rendered WatchScene instead (a real ~200px watch face, crisp at any DPR,
// no photo detail to lose), and lg+ keeps the photo.
//
// Both render server-side; only one is ever visible, and the hidden one is
// display:none rather than mounted-and-clipped.
export default function WatchShareImage() {
  return (
    <div className="relative w-full max-w-[600px]">
      {/* Phones + tablets: the crisp rendered watch. */}
      <div className="lg:hidden">
        <WatchScene />
      </div>

      {/* Desktop: the photo, where there's room for it to read. */}
      <div className="hidden lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/marketing/watch-share.jpg"
          alt="Share your SwiftCard from your iPhone and Apple Watch"
          width={1298}
          height={648}
          className="w-full h-auto block rounded-2xl"
        />
      </div>
    </div>
  );
}
