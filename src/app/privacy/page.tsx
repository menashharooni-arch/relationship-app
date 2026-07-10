import type { Metadata } from "next";
import Link from "next/link";
import SwiftCardLogo from "@/components/SwiftCardLogo";

export const metadata: Metadata = {
  title: "Privacy Policy — SwiftCard",
  description: "How SwiftCard collects, uses, and protects your information.",
};

// Plain-language privacy policy reflecting what the product actually does.

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold text-slate-900 mt-10 mb-3">{children}</h2>;
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
      <nav className="border-b border-warm-border bg-cream/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/"><SwiftCardLogo size={26} /></Link>
          <Link href="/cards/new" className="bg-brand hover:bg-brand-dark text-white font-semibold px-5 py-2 rounded-full text-sm transition-colors">Get started</Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-14 w-full">
        <h1 className="text-3xl font-bold text-slate-900 mb-8">Privacy Policy</h1>

        <P>
          SwiftCard (&quot;SwiftCard&quot;, &quot;we&quot;, &quot;us&quot;) provides digital business cards, link-in-bio pages,
          and contact-management tools at swiftcard.me. This policy explains what information we collect,
          how we use it, and the choices you have. We keep it in plain English on purpose.
        </P>

        <H2>Information you give us</H2>
        <ul className="mb-3">
          <LI><strong>Account details</strong> — your name and email address when you sign up (or the profile shared by Google if you sign in with Google).</LI>
          <LI><strong>Card content</strong> — everything you choose to put on your card or Swift Links page: name, title, company, phone numbers, email, website, address, photo, logo, bio, and social links. This content is public by design — anyone with your card link can see it.</LI>
          <LI><strong>Contacts you collect</strong> — when someone fills out the &quot;share your info&quot; form on your card, their name, phone, email, company, and message are stored in your account&apos;s contact list.</LI>
          <LI><strong>Payment details</strong> — handled entirely by Stripe. We never see or store your card number.</LI>
          <LI><strong>Business-card photos</strong> — if you use the AI card scanner, the photo you take is sent to our AI provider to extract the contact details, then used only to create the contact.</LI>
        </ul>

        <H2>Information collected automatically</H2>
        <ul className="mb-3">
          <LI><strong>View analytics</strong> — when someone opens a card or Swift Links page, we record the view with an approximate location (city/country derived from IP address by our hosting provider), the source (QR code, link, etc.), and basic device info. We do not store visitors&apos; IP addresses with these views.</LI>
          <LI><strong>Usage basics</strong> — standard logs and cookies needed to keep you signed in and keep the service secure. We don&apos;t run third-party advertising trackers.</LI>
        </ul>

        <H2>How we use information</H2>
        <ul className="mb-3">
          <LI>To run the product: host your card, deliver your Swift Links page, store your contacts, and show you your analytics.</LI>
          <LI>To send messages you set up: follow-up emails (and, where enabled, texts) to your contacts, sent on your behalf with your name.</LI>
          <LI>To notify you: new-contact alerts by email, in-app notification, and push notification if you turn push on.</LI>
          <LI>To bill you (Stripe) and to send service emails like receipts. Marketing emails are optional — every one includes an unsubscribe link.</LI>
          <LI>We <strong>never sell your data</strong>, and we never sell your contacts&apos; data. Your contact list is yours.</LI>
        </ul>

        <H2>Who we share it with</H2>
        <P>Only the service providers needed to run SwiftCard, under their own privacy commitments:</P>
        <ul className="mb-3">
          <LI><strong>Supabase</strong> — database and authentication.</LI>
          <LI><strong>Vercel</strong> — hosting and content delivery.</LI>
          <LI><strong>Stripe</strong> — payments and subscriptions.</LI>
          <LI><strong>Resend</strong> — sending email.</LI>
          <LI><strong>Twilio</strong> — sending text messages (where SMS features are enabled).</LI>
          <LI><strong>AI providers</strong> (e.g. Google Gemini) — only for features you actively use, like the card scanner or AI-drafted follow-ups.</LI>
        </ul>
        <P>
          If you connect an integration yourself — Google Contacts, Zapier, or a CRM — we send new contacts to that
          service because you asked us to. Disconnect anytime in Settings → Integrations. SwiftCard&apos;s use of
          information received from Google APIs adheres to the Google API Services User Data Policy, including the
          Limited Use requirements.
        </P>

        <H2>Your contacts&apos; choices</H2>
        <P>
          People who share their info through your card can opt out of messages at any time: replying STOP to a text
          suppresses texts to that number across SwiftCard, and every automated email includes an unsubscribe link.
        </P>

        <H2>Data retention &amp; deleting your account</H2>
        <P>
          We keep your data while your account is active. You can delete your account in Settings → Manage account —
          after deletion you have one month to reopen it by logging back in; after that the deletion is permanent.
          You can export your contacts to CSV before deleting.
        </P>

        <H2>Security</H2>
        <P>
          Data is encrypted in transit (HTTPS everywhere) and at rest by our database provider. Integration tokens
          (like your Google connection) are stored encrypted. No system is 100% secure, but we design so that a
          visitor can only ever see what you chose to make public.
        </P>

        <H2>Children</H2>
        <P>SwiftCard is not directed to children under 13, and we don&apos;t knowingly collect their information.</P>

        <H2>Changes</H2>
        <P>
          If we make meaningful changes to this policy we&apos;ll update the date above and, for significant changes,
          notify you by email or in the app.
        </P>

        <H2>Contact us</H2>
        <P>
          Questions or requests (including data access or deletion): reach us through the{" "}
          <Link href="/contact" className="text-brand underline">contact page</Link>.
          SwiftCard · New York, NY.
        </P>
      </div>

      <footer className="border-t border-warm-border py-10 px-6 bg-cream mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <SwiftCardLogo size={24} />
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/" className="hover:text-slate-900 transition-colors">Home</Link>
            <Link href="/pricing" className="hover:text-slate-900 transition-colors">Pricing</Link>
            <Link href="/contact" className="hover:text-slate-900 transition-colors">Contact</Link>
          </div>
          <p className="text-slate-400 text-xs">© {new Date().getFullYear()} SwiftCard · New York, NY</p>
        </div>
      </footer>
    </main>
  );
}
