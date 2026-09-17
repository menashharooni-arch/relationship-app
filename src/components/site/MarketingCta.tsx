import HomeCardPhone from "./HomeCardPhone";

// The closing call-to-action panel from the homepage, for every other
// marketing page: the brand-gradient panel with the breathing rings and a real
// SwiftCard rising out of it. The page passes its own words and buttons as
// children, so each page keeps its copy. Styles: .hp-final* in app/home.css
// (import it on the page).
export default function MarketingCta({ children, phone = true }: { children: React.ReactNode; phone?: boolean }) {
  return (
    <section className="relative px-4 sm:px-6 pt-4 pb-20 sm:pb-28">
      <div className="hp-final max-w-7xl mx-auto px-6 sm:px-14 py-16 sm:py-24" data-reveal="scale">
        <div className="hp-final-rings hidden md:block" aria-hidden="true"><span /><span /><span /><span /></div>
        {phone && <div className="hp-final-phone hidden lg:block"><HomeCardPhone /></div>}
        <div className="relative max-w-2xl text-white">{children}</div>
        {phone && (
          <div className="lg:hidden relative mt-10 -mb-16 sm:-mb-24 h-[320px] overflow-hidden flex justify-center">
            <div className="rotate-[-3deg] origin-top"><HomeCardPhone width={250} /></div>
          </div>
        )}
      </div>
    </section>
  );
}
