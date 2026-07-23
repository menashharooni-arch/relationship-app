import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/site/SiteNav";
import SwiftCardLogo from "@/components/SwiftCardLogo";
import NativeHidden from "@/components/NativeHidden";

export const metadata: Metadata = {
  title: "SMS & Messaging Terms — SwiftCard",
  description:
    "How text messaging works on SwiftCard: the messages we send, how consent is collected, message frequency, rates, and how to opt out with STOP or get help with HELP.",
};

const LAST_UPDATED = "July 21, 2026";

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold text-slate-900 mt-10 mb-3">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-slate-600 text-[15px] leading-relaxed mb-3">{children}</p>;
}
function LI({ children }: { children: React.ReactNode }) {
  return <li className="text-slate-600 text-[15px] leading-relaxed mb-1.5 ml-5 list-disc">{children}</li>;
}

export default function SmsTermsPage() {
  return (
    <main className="min-h-screen bg-cream flex flex-col">
      <SiteNav />

      <div className="max-w-3xl mx-auto px-6 pt-28 pb-14 w-full">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">SMS &amp; Messaging Terms</h1>
        <p className="text-slate-500 text-sm mb-8">Last updated: {LAST_UPDATED}</p>

        <P>
          These terms describe SwiftCard&apos;s text-messaging program. SwiftCard is operated by{" "}
          <strong>Swift Card Inc</strong> (see our <Link href="/company" className="text-brand underline">Company page</Link>).
          They apply to any text message sent through SwiftCard, and they supplement our{" "}
          <Link href="/terms" className="text-brand underline">Terms of Service</Link> and{" "}
          <Link href="/privacy" className="text-brand underline">Privacy Policy</Link>.
        </P>

        {/* At-a-glance summary card */}
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-5 sm:p-6 my-6">
          <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-slate-500 mb-3">The short version</p>
          <ul>
            <LI>SwiftCard sends texts <strong>on behalf of its users</strong> to people who shared contact info with them — replies, a card link when someone shares their card with you, and follow-up messages a user sets up.</LI>
            <LI>SwiftCard does <strong>not</strong> send marketing text blasts of its own, and never texts its own account holders.</LI>
            <LI>Message frequency varies. Message and data rates may apply.</LI>
            <LI>Reply <strong>STOP</strong> to any message to opt out. Reply <strong>HELP</strong> for help.</LI>
            <LI>We never sell or share your mobile number or opt-in data for third-party marketing.</LI>
          </ul>
        </div>

        <H2>The SwiftCard messaging program</H2>
        <P>
          SwiftCard is a digital business card platform. When you share your contact information with a
          SwiftCard user — for example, through the share form on their card page — that person can follow
          up with you. Where a follow-up is sent by text, it goes out through SwiftCard&apos;s shared
          messaging number, with the sender identified by name in the message itself.
        </P>

        <H2>The types of messages we send</H2>
        <ul className="mb-3">
          <LI>
            <strong>Replies and conversation messages</strong> — a message a SwiftCard user personally writes
            and sends to you after you reached out or shared your info with them.
          </LI>
          <LI>
            <strong>Contact-card messages</strong> — a one-time text with a link to a user&apos;s digital
            business card when they choose to share their contact information with you.
          </LI>
          <LI>
            <strong>Follow-up messages</strong> — messages a SwiftCard user schedules to stay in touch after
            you connect (for example, a &quot;great meeting you&quot; note). These only go to contacts whose
            texts are enabled, and every one honors STOP.
          </LI>
        </ul>
        <P>
          SwiftCard itself does not send promotional text campaigns, and account holders are never texted by
          the platform — all platform notices to account holders go by email or in-app notification.
        </P>

        <H2>How consent is collected</H2>
        <P>
          When you share your contact information on a SwiftCard user&apos;s card, the share form includes a
          separate, <strong>unchecked-by-default</strong>{" "}checkbox asking whether you agree to receive text
          messages. Checking it is optional — you can always share your info without agreeing to texts, and
          consent is never a condition of sharing, of purchase, or of creating an account. If you don&apos;t
          check the box, automated follow-up texts are switched off for your number. See the{" "}
          <Link href="/sms-consent" className="text-brand underline">SMS Consent Overview</Link> for exactly
          what this looks like.
        </P>
        <P>
          Your consent applies to messages from the SwiftCard user you shared your information with, sent
          through SwiftCard. <strong>Consent is not transferable</strong> — it does not extend to unrelated
          companies, and we do not pass your opt-in to anyone else.
        </P>

        <H2>Message frequency</H2>
        <P>
          Message frequency varies. It depends on the conversation and on any follow-up messages the
          SwiftCard user you connected with has set up. This is not a recurring subscription program with a
          fixed cadence.
        </P>

        <H2>Message and data rates</H2>
        <P>
          Message and data rates may apply, depending on your mobile carrier and plan. SwiftCard does not
          charge you to receive messages; your carrier&apos;s standard rates apply.
        </P>

        <H2>Opting out (STOP)</H2>
        <P>
          Reply <strong>STOP</strong> (or STOPALL, UNSUBSCRIBE, CANCEL, END, or QUIT) to any SwiftCard text
          to opt out. Your number is suppressed across all of SwiftCard — no SwiftCard user can text you
          through the platform after that, and automated messages stop immediately. You&apos;ll receive one
          confirmation of your opt-out. Reply <strong>START</strong> to resume messages if you change your
          mind.
        </P>

        <H2>Getting help (HELP)</H2>
        <P>
          Reply <strong>HELP</strong> to any SwiftCard text for assistance, or contact us any time at{" "}
          <a href="mailto:hello@swiftcard.me" className="text-brand underline">hello@swiftcard.me</a> or
          through the <Link href="/contact" className="text-brand underline">contact page</Link>.
        </P>

        <H2>Your mobile information is not sold or shared</H2>
        <P>
          We do not share, sell, or otherwise provide your mobile phone number or messaging consent
          information to any third parties or affiliates for marketing or promotional purposes. Text
          messages are delivered through our messaging provider (Twilio), which processes them only to
          provide the service on our instructions — never for its own marketing. See the{" "}
          <Link href="/privacy" className="text-brand underline">Privacy Policy</Link> for full details.
        </P>

        <H2>Supported carriers &amp; liability</H2>
        <P>
          Messages are supported on major U.S. carriers. Carriers are not liable for delayed or undelivered
          messages.
        </P>

        <H2>Contact</H2>
        <P>
          Questions about these terms:{" "}
          <a href="mailto:hello@swiftcard.me" className="text-brand underline">hello@swiftcard.me</a>.
          SwiftCard is operated by Swift Card Inc · New York, NY, USA.
        </P>
      </div>

      <footer className="border-t border-warm-border py-10 px-6 bg-cream mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <SwiftCardLogo size={24} />
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/" className="hover:text-slate-900 transition-colors">Home</Link>
            <NativeHidden><Link href="/pricing" className="hover:text-slate-900 transition-colors">Pricing</Link></NativeHidden>
            <Link href="/privacy" className="hover:text-slate-900 transition-colors">Privacy</Link>
            <Link href="/contact" className="hover:text-slate-900 transition-colors">Contact Us</Link>
          </div>
          <p className="text-slate-400 text-xs">SwiftCard is operated by Swift Card Inc · New York, NY</p>
        </div>
      </footer>
    </main>
  );
}
