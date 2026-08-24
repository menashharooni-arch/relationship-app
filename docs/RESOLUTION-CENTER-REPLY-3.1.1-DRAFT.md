# DRAFT — Resolution Center reply for the 3.1.1 portion

Status: NOT SENT. Menash reviews and sends alongside the 5.1.1 reply
(RESOLUTION-CENTER-REPLY-5.1.1-DRAFT.md) when the resubmission goes out.

---

Hello,

Regarding Guideline 3.1.1 — Business — Payments — In-App Purchase:

We have added In-App Purchase. The SwiftCard Pro subscription is now offered
in the app as auto-renewable subscriptions (monthly and annual, in the
subscription group "SwiftCard Pro"), purchasable from the paywall that appears
on any locked Pro feature and in Settings → Plan and billing. The paywall
shows StoreKit pricing, includes Restore Purchases, links to our Terms of Use
and Privacy Policy, and states the auto-renewal terms.

Per Guideline 3.1.3(b), the same subscription remains available on our
website, and a purchase on either platform unlocks the same account
everywhere: an In-App Purchase unlocks Pro on the web, and a web purchase
unlocks Pro in the app. Subscriptions purchased in the app are managed and
canceled through the user's Apple account.

We have also removed the external purchase link that was present in the
previous build, so In-App Purchase is the app's only purchase mechanism.

The demo account (applereview@swiftcard.me) is on the Free plan in the app's
own entitlement system, so the paywall and purchase flow can be exercised
end-to-end in the sandbox.

Best regards,
The SwiftCard team

---

NOTE TO SELVES before sending: the demo account currently has plan=pro (it was
made Pro so reviewers could see Pro features). Decide before resubmission:
either downgrade it to free so the reviewer can exercise the purchase flow
(sandbox), or keep it Pro and adjust the last paragraph. Do not send as-is
without resolving this.
