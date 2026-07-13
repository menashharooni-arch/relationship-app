import type { Metadata } from "next";
import SiteNav from "@/components/site/SiteNav";
import Link from "next/link";
import SwiftCardLogo from "@/components/SwiftCardLogo";

export const metadata: Metadata = {
  title: "Terms of Service — SwiftCard",
  description: "The terms that govern your use of SwiftCard.",
};

// Plain-language terms of service reflecting how the product actually works.
// NOTE: this is a good-faith starting template, not legal advice — have a
// lawyer review it before relying on it, especially the liability and
// governing-law sections.

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold text-slate-900 mt-10 mb-3">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-slate-600 text-[15px] leading-relaxed mb-3">{children}</p>;
}
function LI({ children }: { children: React.ReactNode }) {
  return <li className="text-slate-600 text-[15px] leading-relaxed mb-1.5 ml-5 list-disc">{children}</li>;
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-cream flex flex-col">
      <SiteNav />

      <div className="max-w-3xl mx-auto px-6 pt-28 pb-14 w-full">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Terms of Service</h1>
        <p className="text-slate-500 text-sm mb-8">Last updated: July 13, 2026</p>

        <P>
          These terms are an agreement between you and SwiftCard (&quot;SwiftCard&quot;, &quot;we&quot;, &quot;us&quot;)
          for your use of the digital business cards, link-in-bio pages, and contact-management tools at
          swiftcard.me (the &quot;Service&quot;). By creating an account or using the Service, you agree to these
          terms. If you don&apos;t agree, please don&apos;t use the Service. We&apos;ve kept this in plain English on purpose.
        </P>

        <H2>Company information</H2>
        <P>
          Swift Card is a brand operated by <strong>ORION RE SERVICES INC.</strong> Aaron Lavi serves as
          Co-Founder and CEO and is authorized to represent the company.
        </P>
        <dl className="mt-4 mb-3 rounded-xl border border-slate-200 bg-white/60 divide-y divide-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 px-4 py-3">
            <dt className="text-slate-500 text-[13px] font-semibold sm:w-44 shrink-0">Operating entity</dt>
            <dd className="text-slate-800 text-[15px]">ORION RE SERVICES INC.</dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 px-4 py-3">
            <dt className="text-slate-500 text-[13px] font-semibold sm:w-44 shrink-0">Brand</dt>
            <dd className="text-slate-800 text-[15px]">Swift Card (swiftcard.me)</dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 px-4 py-3">
            <dt className="text-slate-500 text-[13px] font-semibold sm:w-44 shrink-0">Authorized representative</dt>
            <dd className="text-slate-800 text-[15px]">Aaron Lavi — Co-Founder &amp; CEO</dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 px-4 py-3">
            <dt className="text-slate-500 text-[13px] font-semibold sm:w-44 shrink-0">Contact</dt>
            <dd className="text-slate-800 text-[15px]">
              <Link href="/contact" className="text-brand underline">swiftcard.me/contact</Link>
            </dd>
          </div>
        </dl>

        <H2>Who can use SwiftCard</H2>
        <P>
          <strong>You must be at least 16 years old to use SwiftCard.</strong> The Service is not directed to
          children, and people under 13 may not use it under any circumstances. If you are under the age of legal
          majority where you live (for example, under 18 in most U.S. states), you may only use SwiftCard with the
          permission and supervision of a parent or legal guardian who agrees to these terms on your behalf. By
          creating an account you represent that you meet these requirements and are able to form a binding
          contract. We may suspend or terminate any account we reasonably believe belongs to an underage user, and
          we will delete its personal information as described in our{" "}
          <Link href="/privacy" className="text-brand underline">Privacy Policy</Link>. If you use SwiftCard on
          behalf of a company or team (for example, an Office account), you confirm you&apos;re authorized to accept
          these terms for that organization.
        </P>

        <H2>Your account</H2>
        <ul className="mb-3">
          <LI>You&apos;re responsible for keeping your login secure and for everything that happens under your account.</LI>
          <LI>Provide accurate information and keep it current — especially your email, which we use for account and billing notices.</LI>
          <LI>Tell us promptly if you suspect unauthorized access.</LI>
        </ul>

        <H2>Your content and your card</H2>
        <P>
          You own the content you put on your card and Swift Links page — your name, details, photos, logo, links,
          and anything else you add. You give us the limited permission we need to host, display, and deliver that
          content as part of running the Service (for example, showing your card to anyone who opens its link, which
          is public by design). You&apos;re responsible for making sure you have the rights to everything you upload and
          that it doesn&apos;t infringe anyone else&apos;s rights.
        </P>

        <H2>Contacts and the data you collect</H2>
        <P>
          When people share their information through your card, or you import or scan contacts, that data is stored
          in your account for you to use. Because that information belongs to real people, you agree that:
        </P>
        <ul className="mb-3">
          <LI>You&apos;ll only collect and use it for legitimate business follow-up, in line with applicable privacy and anti-spam laws (including, where they apply to you, GDPR, CCPA/CPRA, CAN-SPAM, and TCPA).</LI>
          <LI>You have a lawful basis to contact the people you message, and you&apos;ll honor opt-outs. Automated follow-up emails and texts you set up are sent on your behalf, and you&apos;re the sender responsible for them.</LI>
          <LI>You won&apos;t upload contact data you obtained unlawfully, or use SwiftCard to send unsolicited bulk messages.</LI>
        </ul>
        <P>
          For the contacts you collect, you are the data controller and SwiftCard acts as your processor. See our{" "}
          <Link href="/privacy" className="text-brand underline">Privacy Policy</Link> for how we handle personal information.
        </P>

        <H2>Acceptable use</H2>
        <P>Don&apos;t use SwiftCard to:</P>
        <ul className="mb-3">
          <LI>Break the law, infringe intellectual property, or impersonate someone else.</LI>
          <LI>Post or distribute malware, phishing, spam, or misleading, hateful, or unlawful content.</LI>
          <LI>Attack, overload, reverse-engineer, scrape, or attempt to gain unauthorized access to the Service or its data.</LI>
          <LI>Resell or white-label the Service without our written permission.</LI>
        </ul>
        <P>We may suspend or terminate accounts that violate these rules.</P>

        <H2>Plans, billing, and cancellation</H2>
        <ul className="mb-3">
          <LI>SwiftCard offers a Free plan and paid plans (Pro and Office). Current pricing is shown on the <Link href="/pricing" className="text-brand underline">pricing page</Link>.</LI>
          <LI>Paid plans are billed in advance on a recurring basis (monthly or annually) through our payment processor, Stripe, until you cancel. By subscribing you authorize those recurring charges.</LI>
          <LI>You can cancel anytime from your billing settings; cancellation stops future renewals and takes effect at the end of the current billing period. Except where required by law, payments already made are non-refundable.</LI>
          <LI>If a payment fails, we&apos;ll give you a short grace period to update it; if it stays unresolved, your account moves to the Free plan. Your existing cards and contacts aren&apos;t deleted — some paid features simply lock until you upgrade again.</LI>
          <LI>We may change prices or plan features. We&apos;ll give reasonable notice of material changes before they affect your next renewal.</LI>
        </ul>

        <H2>Free trials and promotional offers</H2>
        <P>
          When you subscribe to Pro for the first time, your subscription starts with a free trial (currently 7 days).
          You provide a payment method at checkout, and <strong>when the trial ends your subscription begins and your
          payment method is charged automatically</strong> at the price shown, unless you cancel before the trial ends.
          You can cancel anytime from Settings or the billing portal — cancel during the trial and you won&apos;t be
          charged. One trial per customer. Promotional free months work similarly: when they end, the account returns
          to the Free plan unless a paid subscription is active. Referral and promotional rewards have no cash value
          and may be changed or withdrawn if abused.
        </P>

        <H2>Third-party services</H2>
        <P>
          SwiftCard works with third parties to deliver the Service — including Stripe (payments), Supabase (hosting
          and authentication), Resend (email), Twilio (text messaging), and optional integrations you connect such as
          Google Contacts, HubSpot, and Zapier. Your use of those integrations is also subject to their terms, and
          we&apos;re not responsible for third-party services we don&apos;t control.
        </P>

        <H2>Availability and changes</H2>
        <P>
          We work to keep SwiftCard reliable, but the Service is provided &quot;as is&quot; and we can&apos;t promise it will always
          be uninterrupted or error-free. We may add, change, or remove features, and we may update these terms; if we
          make material changes, we&apos;ll take reasonable steps to let you know. Continuing to use the Service after changes
          take effect means you accept the updated terms.
        </P>

        <H2>Our intellectual property</H2>
        <P>
          The Service itself — the software, design, templates, logos, and everything that makes SwiftCard work — is
          owned by ORION RE SERVICES INC and its licensors, and is protected by copyright, trademark, and other laws.
          These terms give you a limited, revocable, non-exclusive, non-transferable right to use the Service; they
          don&apos;t give you any ownership of it. If you send us ideas or feedback, we may use them freely, without
          any obligation or payment to you.
        </P>

        <H2>Disclaimers</H2>
        <P>
          The Service is provided <strong>&quot;as is&quot; and &quot;as available.&quot;</strong> To the fullest
          extent permitted by law, we disclaim all warranties, express or implied — including implied warranties of
          merchantability, fitness for a particular purpose, and non-infringement. We don&apos;t warrant that the
          Service will be uninterrupted, error-free, or secure, that defects will be corrected, or that the Service
          will produce any particular business result. SwiftCard is a networking tool — we make no promise that you
          will gain leads, contacts, or revenue from using it. Content on other users&apos; cards belongs to those
          users; we don&apos;t verify it and aren&apos;t responsible for it.
        </P>

        <H2>Limitation of liability</H2>
        <P>
          To the fullest extent permitted by law: (a) we are not liable for indirect, incidental, special,
          consequential, exemplary, or punitive damages, or for lost profits, revenue, data, goodwill, or business
          opportunities, even if we&apos;ve been advised such damages are possible; (b) we are not liable for the
          conduct or content of any user or third party, or for events beyond our reasonable control; and (c) our
          total, cumulative liability for all claims relating to the Service is limited to the greater of{" "}
          <strong>$50</strong> or the amount you paid us in the <strong>12 months</strong> before the event giving
          rise to the claim. These limits apply regardless of the theory of liability (contract, tort, negligence,
          statute, or otherwise) and even if a remedy fails of its essential purpose. Some jurisdictions don&apos;t
          allow certain limitations, so some of these may not apply to you; in that case our liability is limited to
          the smallest amount the law allows.
        </P>

        <H2>Indemnification</H2>
        <P>
          You agree to defend, indemnify, and hold harmless ORION RE SERVICES INC, SwiftCard, and their officers,
          employees, and agents from any claims, damages, liabilities, and expenses (including reasonable
          attorneys&apos; fees) arising out of: your content; the contacts you collect and the messages you send
          through the Service; your use of the Service in violation of these terms or of applicable law (including
          privacy and anti-spam laws); or your infringement of anyone else&apos;s rights.
        </P>

        <H2>Dispute resolution — arbitration &amp; class-action waiver</H2>
        <P>
          <strong>Please read this section carefully — it affects your legal rights.</strong> If you have a dispute
          with us, contact us first through the{" "}
          <Link href="/contact" className="text-brand underline">Contact page</Link>; most issues can be resolved
          informally, and we&apos;ll try in good faith for 30 days before either side starts formal proceedings.
        </P>
        <ul className="mb-3">
          <LI><strong>Binding arbitration.</strong> Any dispute that isn&apos;t resolved informally will be settled by binding individual arbitration administered by the American Arbitration Association under its Consumer Arbitration Rules, rather than in court. The Federal Arbitration Act governs this section. Either party may instead bring an individual claim in small-claims court, and either party may seek injunctive relief in court for infringement or misuse of intellectual property.</LI>
          <LI><strong>Class-action waiver.</strong> Disputes will be resolved only on an individual basis. <strong>You and SwiftCard each waive the right to a jury trial and to participate in a class action, class arbitration, or representative proceeding.</strong> If this waiver is found unenforceable for a particular claim, that claim (and only that claim) proceeds in court.</LI>
          <LI><strong>Time limit.</strong> Any claim must be filed within <strong>one year</strong> after it arises, or it is permanently barred, unless a longer period is required by law.</LI>
          <LI><strong>Opt-out.</strong> You may opt out of this arbitration agreement within 30 days of first accepting these terms by telling us through the Contact page with the subject &quot;Arbitration opt-out&quot; and the email on your account. Opting out doesn&apos;t affect any other part of these terms.</LI>
        </ul>

        <H2>Termination</H2>
        <P>
          You can stop using SwiftCard and delete your account at any time from your settings. We may suspend or
          terminate your account if you violate these terms or if we&apos;re required to by law. After deletion, we remove
          your data as described in our Privacy Policy, subject to a short recovery window and any records we&apos;re
          legally required to keep. Sections that by their nature should survive termination (including Your content,
          Disclaimers, Limitation of liability, Indemnification, and Dispute resolution) survive.
        </P>

        <H2>Governing law</H2>
        <P>
          These terms are governed by the laws of the State of New York, without regard to its conflict-of-laws rules.
          Any dispute not subject to arbitration will be handled in the state or federal courts located in New York,
          and both parties consent to their jurisdiction, unless applicable law requires otherwise.
        </P>

        <H2>Miscellaneous</H2>
        <P>
          These terms (with the Privacy Policy) are the entire agreement between you and us about the Service. If any
          part is found unenforceable, the rest remains in effect. Our not enforcing a provision isn&apos;t a waiver
          of it. You may not assign these terms; we may assign them in connection with a merger, acquisition, or sale
          of assets. Nothing in these terms creates a partnership, employment, or agency relationship.
        </P>

        <H2>Contact</H2>
        <P>
          Questions about these terms? Reach us through the{" "}
          <Link href="/contact" className="text-brand underline">Contact page</Link>.
        </P>
      </div>

      <footer className="border-t border-warm-border mt-auto">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-4 text-sm text-slate-500">
          <span>Swift Card, a brand operated by ORION RE SERVICES INC. · New York, NY</span>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="hover:text-slate-900 transition-colors">Privacy</Link>
            <Link href="/contact" className="hover:text-slate-900 transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
