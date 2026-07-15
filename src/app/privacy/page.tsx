import type { Metadata } from "next";
import SiteNav from "@/components/site/SiteNav";
import Link from "next/link";
import SwiftCardLogo from "@/components/SwiftCardLogo";

export const metadata: Metadata = {
  title: "Privacy Policy — SwiftCard",
  description: "How SwiftCard collects, uses, and protects your information.",
};

// Plain-language privacy policy reflecting what the product actually does.
// Keep this accurate: every processor listed here must actually be in use, and
// every data practice (analytics, fraud-prevention signals, retention) must
// match the code. Update LAST_UPDATED whenever the policy meaningfully changes
// (CalOPPA requires an effective date).

const LAST_UPDATED = "July 14, 2026";

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold text-slate-900 mt-10 mb-3">{children}</h2>;
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[15px] font-bold text-slate-800 mt-6 mb-2">{children}</h3>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-slate-600 text-[15px] leading-relaxed mb-3">{children}</p>;
}
function LI({ children }: { children: React.ReactNode }) {
  return <li className="text-slate-600 text-[15px] leading-relaxed mb-1.5 ml-5 list-disc">{children}</li>;
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-cream flex flex-col">
      <SiteNav />

      <div className="max-w-3xl mx-auto px-6 pt-28 pb-14 w-full">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Privacy Policy</h1>
        <p className="text-slate-500 text-sm mb-8">Last updated: {LAST_UPDATED}</p>

        <P>
          SwiftCard (&quot;SwiftCard&quot;, &quot;we&quot;, &quot;us&quot;), a brand operated by ORION RE SERVICES INC,
          provides digital business cards, link-in-bio pages, and contact-management tools at swiftcard.me and in our
          mobile app (together, the &quot;Service&quot;). This policy explains what information we collect, how we use
          it, and the choices and rights you have. We keep it in plain English on purpose. For personal information of
          account holders, SwiftCard is the data controller; for the contacts you collect through your card, you are
          the controller and we process that data on your instructions.
        </P>

        {/* At-a-glance summary — the four promises people actually care about */}
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-5 sm:p-6 my-6">
          <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-slate-500 mb-3">Privacy at a glance</p>
          <ul className="space-y-2">
            {[
              "We never sell your personal information — or your contacts' — to anyone.",
              "No third-party advertising trackers, and no cross-app \"tracking\" as Apple defines it.",
              "Your card shows only what you choose to make public. Everything else stays private.",
              "You can export or permanently delete your data anytime from Settings.",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-slate-700 text-[14px] leading-relaxed">
                <span className="mt-1 w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(5,150,105,.12)" }}>
                  <svg viewBox="0 0 20 20" className="w-2.5 h-2.5" fill="none" stroke="#059669" strokeWidth={3}><path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <H2>Information you give us</H2>
        <ul className="mb-3">
          <LI><strong>Account details</strong> — your name and email address when you sign up (or the profile shared by Google if you sign in with Google).</LI>
          <LI><strong>Card content</strong> — everything you choose to put on your card or Swift Links page: name, title, company, phone numbers, email, website, address, photo, logo, bio, and social links. This content is public by design — anyone with your card link can see it.</LI>
          <LI><strong>Contacts you collect</strong> — when someone fills out the &quot;share your info&quot; form on your card, their name, phone, email, company, and message are stored in your account&apos;s contact list.</LI>
          <LI><strong>Payment details</strong> — handled entirely by Stripe. We never see or store your card number.</LI>
          <LI><strong>Business-card photos</strong> — if you use the AI card scanner, the photo you take is sent to our AI provider to extract the contact details, then used only to create the contact.</LI>
          <LI><strong>Messages to us</strong> — anything you send through the contact form, feedback, or support.</LI>
        </ul>

        <H2>Information collected automatically</H2>
        <ul className="mb-3">
          <LI><strong>View analytics</strong> — when someone opens a card or Swift Links page, we record the view with an approximate location (city/country derived from IP address by our hosting provider), the source (QR code, link, etc.), and basic device info. We do not store visitors&apos; IP addresses with these views.</LI>
          <LI><strong>Product analytics</strong> — we use PostHog to understand how the app is used (pages visited, features used, general device/browser info) so we can improve it. We use this for product improvement only, not third-party advertising.</LI>
          <LI><strong>Fraud-prevention signals</strong> — when you create an account we record your IP address and a coarse, non-unique device signature (derived from your browser type and language). If you subscribe, our payment processor (Stripe) also gives us a non-reversible fingerprint of your payment card — a one-way hash, never your card number. We use these solely to detect abuse of our referral program (for example, one person inviting themselves or claiming the same offer repeatedly across accounts) and to rate-limit abuse. We do not use them for advertising.</LI>
          <LI><strong>Usage basics</strong> — standard server logs and cookies needed to keep you signed in and keep the service secure. We don&apos;t run third-party advertising trackers, and we do not use your data for cross-context behavioral advertising.</LI>
        </ul>

        <H2>App privacy — what our app collects (Apple disclosure)</H2>
        <P>
          Apple requires apps to disclose the categories of data they collect. Whether you use SwiftCard in the
          browser or in our iOS app, the data practices are identical, and here they are in Apple&apos;s categories.
          None of this data is used for &quot;tracking&quot; as Apple defines it — we do not link your data with
          third-party data for advertising, and we do not share it with data brokers.
        </P>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white/70 my-4">
          <table className="w-full text-[13.5px]" style={{ minWidth: 560 }}>
            <thead>
              <tr className="text-left text-slate-500 text-[11px] uppercase tracking-wide border-b border-slate-200">
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">What it includes</th>
                <th className="px-4 py-3 font-semibold">Linked to you?</th>
                <th className="px-4 py-3 font-semibold">Used to track you?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {[
                ["Contact info", "Name, email, phone number you add to your account or card", "Yes", "No"],
                ["User content", "Card content, photos & logo, bio, the contacts you collect, messages to support", "Yes", "No"],
                ["Identifiers", "Your account ID", "Yes", "No"],
                ["Purchases", "Subscription/purchase history (payments handled by Stripe)", "Yes", "No"],
                ["Usage data", "Pages visited and features used (product analytics)", "Yes", "No"],
                ["Diagnostics", "Standard server logs used for security and reliability", "Yes", "No"],
                ["Coarse location", "City/country of card views, derived from IP (visitor IPs not stored with views)", "No", "No"],
              ].map(([cat, what, linked, track]) => (
                <tr key={cat}>
                  <td className="px-4 py-2.5 font-semibold text-slate-900 whitespace-nowrap">{cat}</td>
                  <td className="px-4 py-2.5">{what}</td>
                  <td className="px-4 py-2.5">{linked}</td>
                  <td className="px-4 py-2.5">{track}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <H2>How we use information</H2>
        <ul className="mb-3">
          <LI>To run the product: host your card, deliver your Swift Links page, store your contacts, and show you your analytics.</LI>
          <LI>To send messages you set up: follow-up emails (and, where enabled, texts) to your contacts, sent on your behalf with your name.</LI>
          <LI>To notify you: new-contact alerts by in-app notification, and by push notification if you turn push on.</LI>
          <LI>To bill you (Stripe) and to send service emails like receipts. Marketing emails are optional — every one includes an unsubscribe link.</LI>
          <LI>To keep the Service secure, prevent fraud and abuse, and comply with law.</LI>
          <LI>We <strong>never sell your personal information</strong>, we don&apos;t &quot;share&quot; it for cross-context behavioral advertising (as those terms are defined in the California Consumer Privacy Act), and we never sell your contacts&apos; data. Your contact list is yours.</LI>
        </ul>
        <P>
          Where the GDPR or UK GDPR applies, our legal bases are: <strong>performance of a contract</strong> (running
          the Service you signed up for), <strong>legitimate interests</strong> (security, fraud prevention, product
          analytics, and improving the Service), <strong>consent</strong> (optional marketing and push notifications —
          withdrawable anytime), and <strong>legal obligation</strong> (tax and accounting records).
        </P>

        <H2>Who we share it with</H2>
        <P>Only the service providers needed to run SwiftCard, under contracts limiting them to processing on our instructions:</P>
        <ul className="mb-3">
          <LI><strong>Supabase</strong> — database, file storage, and authentication.</LI>
          <LI><strong>Vercel</strong> — hosting and content delivery.</LI>
          <LI><strong>Stripe</strong> — payments and subscriptions.</LI>
          <LI><strong>Resend</strong> — sending email.</LI>
          <LI><strong>Twilio</strong> — sending text messages (where SMS features are enabled).</LI>
          <LI><strong>PostHog</strong> — product analytics.</LI>
          <LI><strong>Upstash</strong> — rate limiting (helps stop abuse of our forms and APIs).</LI>
          <LI><strong>AI providers</strong> (e.g. Google Gemini) — only for features you actively use, like the card scanner or AI-drafted follow-ups.</LI>
        </ul>
        <P>
          If you connect an integration yourself — Google Contacts, Zapier, or a CRM — we send new contacts to that
          service because you asked us to. Disconnect anytime in Settings → Integrations. SwiftCard&apos;s use of
          information received from Google APIs adheres to the Google API Services User Data Policy, including the
          Limited Use requirements.
        </P>
        <P>
          We may also disclose information if required by law or legal process, to protect the rights, safety, or
          property of SwiftCard or others, or as part of a merger, acquisition, or sale of assets (in which case this
          policy continues to apply and we&apos;ll notify you of any successor).
        </P>

        <H2>International transfers</H2>
        <P>
          We are based in the United States and our providers process data primarily in the U.S. If you use SwiftCard
          from outside the U.S. (including the EEA, UK, or Switzerland), your information is transferred to the U.S.
          Where required, we rely on our processors&apos; safeguards for those transfers, such as Standard Contractual
          Clauses and Data Privacy Framework certifications.
        </P>

        <H2>Your privacy rights</H2>
        <P>
          Everyone can access, correct, export, or delete their information — most of it directly in the app
          (Settings → Manage account, and CSV export for contacts), or by contacting us via the{" "}
          <Link href="/contact" className="text-brand underline">contact page</Link>. We respond to verifiable requests
          within the time required by applicable law, and we never discriminate against you for exercising a privacy right.
        </P>
        <H3>If you&apos;re in California</H3>
        <P>
          The CCPA/CPRA gives you the right to know what personal information we collect and how it&apos;s used (this
          policy), to access it, correct it, delete it, and to opt out of &quot;sale&quot; or &quot;sharing&quot; of
          personal information. <strong>We do not sell or share personal information</strong> (including that of anyone
          under 16), and we do not use or disclose sensitive personal information for purposes requiring a right to
          limit. You may designate an authorized agent to make requests for you. Because we don&apos;t sell or share
          data, browser opt-out signals such as Global Privacy Control and &quot;Do Not Track&quot; don&apos;t change how
          we process your data; we treat all visitors by the standards in this policy.
        </P>
        <H3>If you&apos;re in the EEA, UK, or Switzerland</H3>
        <P>
          You have the rights of access, rectification, erasure, restriction, portability, and objection (including to
          processing based on legitimate interests), and the right to withdraw consent at any time without affecting
          prior processing. You can also lodge a complaint with your local supervisory authority, though we&apos;d
          appreciate the chance to resolve any concern directly first.
        </P>
        <H3>Contacts collected through cards</H3>
        <P>
          If your information was collected by a SwiftCard user (you filled out someone&apos;s card form), that user
          controls it — contact them directly, or contact us and we&apos;ll assist. You can opt out of their messages at
          any time: replying STOP to a text suppresses texts to your number across SwiftCard, and every automated email
          includes an unsubscribe link.
        </P>

        <H2>Data retention &amp; deleting your account</H2>
        <P>
          We keep your data while your account is active. You can delete your account in Settings → Manage account —
          after deletion you have one month to reopen it by logging back in; after that the deletion is permanent and
          your data is removed from our production systems (residual copies in encrypted backups expire on their
          normal rotation). We retain billing records as required by tax law. You can export your contacts to CSV
          before deleting.
        </P>

        <H2>Security</H2>
        <P>
          Data is encrypted in transit (HTTPS everywhere) and at rest by our database provider. Integration tokens
          (like your Google connection) are stored encrypted. No system is 100% secure, but we design so that a
          visitor can only ever see what you chose to make public. If a breach affecting your personal information
          occurs, we&apos;ll notify you and regulators as required by law.
        </P>

        <H2>Children</H2>
        <P>
          SwiftCard is a professional networking tool. It is not directed to children, and{" "}
          <strong>you must be at least 16 years old to create an account</strong> (see our{" "}
          <Link href="/terms" className="text-brand underline">Terms of Service</Link>). We do not knowingly collect
          personal information from anyone under 16 — and never from children under 13, consistent with the
          U.S. Children&apos;s Online Privacy Protection Act (COPPA). If we learn that an account belongs to someone
          under 16, we will terminate it and delete the associated personal information. If you believe a child has
          provided us personal information, contact us via the{" "}
          <Link href="/contact" className="text-brand underline">contact page</Link> and we&apos;ll delete it promptly.
        </P>

        <H2>Changes</H2>
        <P>
          If we make meaningful changes to this policy we&apos;ll update the &quot;Last updated&quot; date above and,
          for significant changes, notify you by email or in the app before they take effect.
        </P>

        <H2>Contact us</H2>
        <P>
          Questions or requests (including data access, correction, or deletion): reach us through the{" "}
          <Link href="/contact" className="text-brand underline">contact page</Link>.
          SwiftCard, a brand operated by ORION RE SERVICES INC · New York, NY, USA.
        </P>
      </div>

      <footer className="border-t border-warm-border py-10 px-6 bg-cream mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <SwiftCardLogo size={24} />
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/" className="hover:text-slate-900 transition-colors">Home</Link>
            <Link href="/pricing" className="hover:text-slate-900 transition-colors">Pricing</Link>
            <Link href="/contact" className="hover:text-slate-900 transition-colors">Contact Us</Link>
          </div>
          <p className="text-slate-400 text-xs">© {new Date().getFullYear()} SwiftCard · New York, NY</p>
        </div>
      </footer>
    </main>
  );
}
