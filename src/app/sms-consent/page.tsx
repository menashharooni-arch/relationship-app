import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/site/SiteNav";
import SwiftCardLogo from "@/components/SwiftCardLogo";
import NativeHidden from "@/components/NativeHidden";

export const metadata: Metadata = {
  title: "SMS Consent Overview — SwiftCard",
  description:
    "How people opt in to receive text messages on SwiftCard: where the consent disclosure appears, the exact wording shown, and how opt-out works.",
};

const LAST_UPDATED = "July 28, 2026";

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold text-slate-900 mt-10 mb-3">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-slate-600 text-[15px] leading-relaxed mb-3">{children}</p>;
}
function LI({ children }: { children: React.ReactNode }) {
  return <li className="text-slate-600 text-[15px] leading-relaxed mb-1.5 ml-5 list-disc">{children}</li>;
}

export default function SmsConsentPage() {
  return (
    <main className="min-h-screen bg-cream flex flex-col">
      <SiteNav />

      <div className="max-w-3xl mx-auto px-6 pt-28 pb-14 w-full">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">SMS Consent Overview</h1>
        <p className="text-slate-500 text-sm mb-8">Last updated: {LAST_UPDATED}</p>

        <P>
          This page shows exactly how SwiftCard collects consent to send text messages. SwiftCard is a
          digital business card platform operated by <strong>Swift Card Inc</strong> (see our{" "}
          <Link href="/company" className="text-brand underline">Company page</Link>). The full program terms
          are in our <Link href="/sms-terms" className="text-brand underline">SMS &amp; Messaging Terms</Link>{" "}
          and <Link href="/privacy" className="text-brand underline">Privacy Policy</Link>.
        </P>

        <H2>Where the opt-in appears</H2>
        <P>
          Every SwiftCard user has a public card page (for example, swiftcard.me/card/their-name). When a
          visitor wants to share their contact information with that person, they use the{" "}
          <strong>&quot;Share your info&quot;</strong> form on the card. The SMS consent disclosure sits
          directly on that form, immediately next to the submit button — the same block appears on every
          variation of the share form across the site (the card&apos;s share form, the post-save
          share-back sheet, the &quot;reach out&quot; message modal, and the social-link share prompt).
        </P>

        <H2>The consent flow, step by step</H2>
        <ul className="mb-3">
          <LI>A visitor opens a SwiftCard user&apos;s public card page.</LI>
          <LI>
            They choose to share their contact info and enter their name, phone number, and email. Nothing
            is collected unless the visitor deliberately opens this form and fills it in.
          </LI>
          <LI>
            Immediately next to the submit button, before they submit, they see the full disclosure quoted
            below: that sharing means receiving follow-up texts and emails via SwiftCard, that message
            frequency varies, that msg &amp; data rates may apply, and that STOP opts out and HELP gets help.
          </LI>
          <LI>
            <strong>Submitting the form is the affirmative opt-in.</strong> The visitor is giving their phone
            number for the express purpose of being followed up with, and the disclosure telling them so is
            in plain sight above the button they press. Consent is never bundled into an unrelated action,
            and is never a condition of purchase or account creation.
          </LI>
          <LI>
            The card owner can switch text follow-ups off for any contact at any time from their Contacts
            list, independently of the visitor&apos;s own STOP.
          </LI>
          <LI>Every message thereafter honors STOP (opt out platform-wide) and HELP (assistance).</LI>
        </ul>

        <H2>See the live opt-in for yourself</H2>
        <P>
          The consent flow is on a public page — no login, no demo environment. Rather than
          screenshots, which can go stale or be doctored, here is the real thing:
        </P>

        <div className="rounded-2xl border border-slate-200 bg-white/70 p-5 sm:p-6 my-6">
          <a
            href="https://swiftcard.me/card/swift-card-swift-card-inc"
            target="_blank"
            rel="noopener"
            className="text-brand underline font-semibold text-[15px] break-all"
          >
            swiftcard.me/card/swift-card-swift-card-inc
          </a>
          <p className="text-slate-600 text-[15px] leading-relaxed mt-3">
            Scroll to <strong>&quot;Share your info&quot;</strong>. The disclosure quoted below sits
            directly above the <strong>Share My Info</strong> button, visible before anything is
            submitted. This is SwiftCard&apos;s own card on its own platform — every other card on
            the site shows the identical block.
          </p>
        </div>

        <H2>The exact disclosure shown</H2>
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-5 sm:p-6 my-6">
          <p className="text-slate-700 text-[14px] leading-relaxed italic">
            &quot;By sharing, you agree to texts &amp; emails via SwiftCard. Msg frequency varies.
            Msg &amp; data rates may apply. Reply STOP to opt out, HELP for help.
            SMS Terms · Privacy&quot;
          </p>
        </div>
        <P>
          The &quot;SMS Terms&quot; and &quot;Privacy Policy&quot; text in the disclosure link directly to{" "}
          <Link href="/sms-terms" className="text-brand underline">swiftcard.me/sms-terms</Link> and{" "}
          <Link href="/privacy" className="text-brand underline">swiftcard.me/privacy</Link>.
        </P>

        <H2>The number messages come from</H2>
        <P>
          Every SwiftCard text — replies, card links, and follow-ups alike — is sent from one shared
          number: <strong>(917) 905-7335</strong>. The SwiftCard user who is writing to you is named in the
          message itself.
        </P>

        <H2>Opting out</H2>
        <P>
          Replying <strong>STOP</strong> to any SwiftCard text suppresses that number across the entire
          platform — no SwiftCard user can text it through SwiftCard afterwards. Replying{" "}
          <strong>HELP</strong> returns program information and support contact details. Questions:{" "}
          <a href="mailto:hello@swiftcard.me" className="text-brand underline">hello@swiftcard.me</a>.
        </P>
      </div>

      <footer className="border-t border-warm-border py-10 px-6 bg-cream mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <SwiftCardLogo size={24} />
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/" className="hover:text-slate-900 transition-colors">Home</Link>
            <NativeHidden><Link href="/pricing" className="hover:text-slate-900 transition-colors">Pricing</Link></NativeHidden>
            <Link href="/sms-terms" className="hover:text-slate-900 transition-colors">SMS Terms</Link>
            <Link href="/privacy" className="hover:text-slate-900 transition-colors">Privacy</Link>
          </div>
          <p className="text-slate-400 text-xs">SwiftCard is operated by Swift Card Inc · New York, NY</p>
        </div>
      </footer>
    </main>
  );
}
