"use client";

import SocialLinkIntercept from "@/components/SocialLinkIntercept";
import CardActionLinks from "@/components/CardActionLinks";
import { SAMPLE_DATA } from "@/components/card-templates/types";
import { buildConnectLinks } from "@/lib/social-url";

// The card page's "Swift Links" box, as the marketing mockups show it.
//
// This exists because the box lives inside THREE phone mockups (TemplateGallery
// on the homepage and /products/digital-cards, LeadCapturePhone, SignatureDemo)
// and every one of them had its own hand-copied version. They drifted: the card
// page moved to the ghost chip, the website capsule, the brand discs and the
// action-link table, and all three mockups were still showing the retired
// full-width "bars" list with a "Go to Swift Links →" footnote. One component,
// used by all three, is what stops that happening again.
//
// The structure below mirrors src/app/card/[username]/page.tsx section 3
// exactly — header + chip, bio, rule, socials rail, rule, action links — and
// the pieces that ARE the design (SocialLinkIntercept's "rail", CardActionLinks)
// are the live components, not copies, so a change there lands here for free.

const FIRST = SAMPLE_DATA.name.split(" ")[0];

// The same connect links the live card builds (website + socials). "rail"
// splits them itself: the website becomes a capsule, the socials become discs.
const CONNECT_LINKS = buildConnectLinks({
  website: SAMPLE_DATA.website,
  linkedin: SAMPLE_DATA.linkedin,
  instagram: SAMPLE_DATA.instagram,
  tiktok: SAMPLE_DATA.tiktok,
  twitter: SAMPLE_DATA.twitter,
});

// Bio and links match the live demo card (/card/demo-realty) so the marketing
// mockup and the card people actually open tell the same story. Both URLs are
// already reached by CONNECT_LINKS, so nothing new is fetched for the favicons.
const BIO = "Bay Area homes, from first tour to closing day. Let's find yours.";
// Labels are kept to ~16 characters on purpose. CardActionLinks truncates its
// row label, and the narrow phone frame leaves it about 128px — "Connect on
// LinkedIn" came back as "Connect on Link…", which reads as a bug in a mockup
// even though it is the real component behaving correctly.
const ACTION_LINKS = [
  { label: "Book a viewing", url: "https://coastlinehomes.com" },
  { label: "Current listings", url: "https://coastlinehomes.com" },
  { label: "Client reviews", url: "https://linkedin.com/in/alexmorgan" },
];

const RULE = <div className="h-px bg-[#EFE9E1]" />;

/**
 * `compact` is the 300px-wide phone frame (TemplateGallery, LeadCapturePhone),
 * where the mockups' own chrome — badge, heading, chip — runs one step down
 * from the real card's. SignatureDemo renders at the card's true scale, so it
 * passes compact={false} and is pixel-identical to the live page.
 *
 * Only the chrome scales. The embedded live components keep their real sizes,
 * which is the convention these mockups already follow for the socials block.
 */
export default function DemoSwiftLinks({ n = 3, compact = true }: { n?: number; compact?: boolean }) {
  return (
    <>
      <div className={`flex items-center justify-between gap-3 ${compact ? "mb-3" : "mb-3"}`}>
        <div className={`flex items-center ${compact ? "gap-2.5" : "gap-3"} min-w-0`}>
          <span
            className={`rounded-full flex items-center justify-center shrink-0 font-bold text-white ${compact ? "w-5 h-5 text-[10px]" : "w-6 h-6 text-xs"}`}
            style={{ background: "#1D4ED8" }}
          >
            {n}
          </span>
          <p className={`text-slate-900 font-semibold whitespace-nowrap ${compact ? "text-[13px]" : "text-sm"}`}>Swift Links</p>
        </div>
        {/* The card page's warm ghost chip. A span, not a link: everything in
            these mockups is display-only, and a chip that looks clickable and
            does nothing is worse than one that never invited the tap. Hover
            styling is dropped for the same reason.

            The compact frame abbreviates the label. Measured, not guessed: that
            header row is 213px wide inside the phone, and the full
            "View Swift Link page →" leaves the heading 44px — it wrapped
            "Swift Links" onto two lines. The alternative was shrinking the
            heading, but it would then be smaller than "Save Alex's contact" and
            "Share this card" in the same phone, which reads as a bug. The
            chip's position, weight and colour are what carry the design here;
            SignatureDemo renders at true scale and keeps the full wording. */}
        <span
          className={`shrink-0 whitespace-nowrap font-medium text-slate-500 rounded-full bg-[#FAF7F2] ${compact ? "text-[10px] px-2 py-[3px]" : "text-[11px] px-2.5 py-1"}`}
          style={{ boxShadow: "inset 0 0 0 1px #EFE9E1" }}
        >
          {compact ? "View page →" : "View Swift Link page →"}
        </span>
      </div>

      {/* ml matches the numbered badge + gap above it, the card page's
          convention for copy under a section number. */}
      <p className={`text-slate-600 leading-[1.6] ${compact ? "text-[12px] ml-[30px]" : "text-[13px] ml-9"}`}>{BIO}</p>

      <div className={compact ? "my-3" : "my-4"}>{RULE}</div>

      <div style={{ pointerEvents: "none" }}>
        <SocialLinkIntercept
          links={CONNECT_LINKS}
          cardOwner="alexmorgan"
          ownerFirstName={FIRST}
          variant="rail"
        />
      </div>

      <div className={compact ? "my-3" : "my-4"}>{RULE}</div>

      <div style={{ pointerEvents: "none" }}>
        <CardActionLinks links={ACTION_LINKS} />
      </div>
    </>
  );
}
