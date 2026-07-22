import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import SiteNav from "@/components/site/SiteNav";
import SwiftCardLogo from "@/components/SwiftCardLogo";
import NativeHidden from "@/components/NativeHidden";

export const metadata: Metadata = {
  title: "SMS Consent Overview — SwiftCard",
  description:
    "How people opt in to receive text messages on SwiftCard: where the consent checkbox appears, the exact disclosure shown, and how opt-out works.",
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
          <strong>&quot;Share your info&quot;</strong> form on the card. The SMS opt-in is a separate,{" "}
          <strong>unchecked-by-default</strong> checkbox directly on that form — the same block appears on
          every variation of the share form across the site (the card&apos;s share form, the post-save
          share-back sheet, the &quot;reach out&quot; message modal, and the social-link share prompt).
        </P>

        <H2>The consent flow, step by step</H2>
        <ul className="mb-3">
          <LI>A visitor opens a SwiftCard user&apos;s public card page.</LI>
          <LI>They choose to share their contact info and enter their name and phone number.</LI>
          <LI>
            Next to the submit button is the SMS consent checkbox — <strong>unchecked by default</strong>. It
            must be actively checked to opt in; nothing pre-selects it.
          </LI>
          <LI>
            Checking the box is <strong>optional</strong>: the visitor can share their info without opting in
            to texts, and consent is never a condition of sharing, purchase, or account creation. If the box
            is left unchecked, automated text follow-ups are switched off for that number.
          </LI>
          <LI>Every message thereafter honors STOP (opt out platform-wide) and HELP (assistance).</LI>
        </ul>

        <H2>What the visitor sees</H2>
        <P>
          Current production screenshots of the real consent flow, shown on a demo card (&quot;Alex
          Morgan&quot; is a fictional demonstration profile — no customer information appears):
        </P>

        <div className="grid sm:grid-cols-2 gap-4 my-6">
          <figure className="rounded-2xl border border-slate-200 bg-white/70 p-4">
            <Image
              src="/sms-consent/share-form.png"
              alt="A SwiftCard public card page on a phone, showing the Share-your-info form with the unchecked SMS consent checkbox below the submit button"
              width={430}
              height={932}
              className="rounded-xl border border-slate-200 w-full h-auto"
            />
            <figcaption className="text-slate-500 text-xs mt-2 text-center">
              The card page with the share form in context
            </figcaption>
          </figure>
          <figure className="rounded-2xl border border-slate-200 bg-white/70 p-4">
            <Image
              src="/sms-consent/consent-closeup.png"
              alt="Close-up of the share form: name, phone, and email fields, the Share My Info button, and the unchecked SMS consent checkbox with its full disclosure text and links to the SMS Terms and Privacy Policy"
              width={280}
              height={345}
              className="rounded-xl border border-slate-200 w-full h-auto"
            />
            <figcaption className="text-slate-500 text-xs mt-2 text-center">
              The consent checkbox, unchecked by default
            </figcaption>
          </figure>
        </div>

        <H2>The exact disclosure shown</H2>
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-5 sm:p-6 my-6">
          <p className="text-slate-700 text-[14px] leading-relaxed italic">
            &quot;By checking this box, you allow [the card owner&apos;s name] to text you via SwiftCard.
            Msg frequency varies, msg &amp; data rates may apply, reply STOP/HELP. Not required to share.
            See our SMS Terms and Privacy Policy.&quot;
          </p>
        </div>
        <P>
          The &quot;SMS Terms&quot; and &quot;Privacy Policy&quot; text in the disclosure link directly to{" "}
          <Link href="/sms-terms" className="text-brand underline">swiftcard.me/sms-terms</Link> and{" "}
          <Link href="/privacy" className="text-brand underline">swiftcard.me/privacy</Link>.
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
