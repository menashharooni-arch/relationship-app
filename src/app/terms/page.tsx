import type { Metadata } from "next";
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
      <nav className="border-b border-warm-border bg-cream/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/"><SwiftCardLogo size={26} /></Link>
          <Link href="/login?mode=signup" className="bg-brand hover:bg-brand-dark text-white font-semibold px-5 py-2 rounded-full text-sm transition-colors">Get started</Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-14 w-full">
        <h1 className="text-3xl font-bold text-slate-900 mb-8">Terms of Service</h1>

        <P>
          These terms are an agreement between you and SwiftCard (&quot;SwiftCard&quot;, &quot;we&quot;, &quot;us&quot;)
          for your use of the digital business cards, link-in-bio pages, and contact-management tools at
          swiftcard.me (the &quot;Service&quot;). By creating an account or using the Service, you agree to these
          terms. If you don&apos;t agree, please don&apos;t use the Service. We&apos;ve kept this in plain English on purpose.
        </P>

        <H2>Who can use SwiftCard</H2>
        <P>
          You must be at least 16 years old and able to form a binding contract. If you use SwiftCard on behalf
          of a company or team (for example, an Office account), you confirm you&apos;re authorized to accept these
          terms for that organization.
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
          New accounts may receive a trial of paid features or promotional free months. When a trial or promotional
          period ends, the account returns to the Free plan unless you&apos;ve started a paid subscription. Referral and
          promotional rewards have no cash value and may be changed or withdrawn if abused.
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

        <H2>Disclaimers and limitation of liability</H2>
        <P>
          To the fullest extent permitted by law, SwiftCard disclaims all warranties not expressly stated here, and we
          are not liable for indirect, incidental, or consequential damages, or for lost profits, data, or goodwill. Our
          total liability for any claim relating to the Service is limited to the amount you paid us in the 12 months
          before the claim. Some jurisdictions don&apos;t allow certain limitations, so some of these may not apply to you.
        </P>

        <H2>Termination</H2>
        <P>
          You can stop using SwiftCard and delete your account at any time from your settings. We may suspend or
          terminate your account if you violate these terms or if we&apos;re required to by law. After deletion, we remove
          your data as described in our Privacy Policy, subject to a short recovery window and any records we&apos;re
          legally required to keep.
        </P>

        <H2>Governing law</H2>
        <P>
          These terms are governed by the laws of the State of New York, without regard to its conflict-of-laws rules,
          and any disputes will be handled in the state or federal courts located in New York, unless applicable law
          requires otherwise.
        </P>

        <H2>Contact</H2>
        <P>
          Questions about these terms? Reach us through the{" "}
          <Link href="/contact" className="text-brand underline">Contact page</Link>.
        </P>
      </div>

      <footer className="border-t border-warm-border mt-auto">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-4 text-sm text-slate-500">
          <span>SwiftCard · New York, NY</span>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="hover:text-slate-900 transition-colors">Privacy</Link>
            <Link href="/contact" className="hover:text-slate-900 transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
