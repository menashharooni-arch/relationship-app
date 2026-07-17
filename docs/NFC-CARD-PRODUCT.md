# SwiftCard Physical NFC Card — Product Spec

_The "tap my card on any phone → my SwiftCard opens" product. This is the
credit-card-tap experience Apple won't allow from a Wallet pass — delivered the
way Popl/Mobilo/every competitor does it: a passive NFC card any iPhone or
Android reads natively, no app needed on either side._

---

## 1. Product line

| SKU | Material | Look | Target price | Est. landed cost* |
|---|---|---|---|---|
| **SwiftCard Tap** (core) | Matte-black PVC, CR80 credit-card size | White SwiftCard bolt + owner QR on back | **$29** | $1–2 |
| **SwiftCard Tap Custom** | PVC, full-color both sides | Owner's name/logo/brand colors | **$39–49** | $2–4 |
| **SwiftCard Tap Metal** (later) | Brushed metal + PVC NFC inlay | Laser-engraved | **$79–99** | $8–15 |
| **Office Team Pack** | 10× Custom w/ company branding | Uniform team design | **$299/10** ($30/card) | $20–40 |

\*at 100–500 unit volumes; falls fast with quantity. Competitor anchors: premium
NFC cards run **$25–150 one-time** (Mobilo from ~$29; Linq now $29/seat/mo
subscription — SwiftCard undercuts on lifetime cost since the card is one-time
and the subscription is optional).

## 2. Hardware spec

- **Chip: NTAG215** (504 bytes usable). The industry default — universally read
  by iPhone (background tag reading, iPhone XS+) and Android. NTAG213 (144B)
  also fits our URL but 215 is the same price at volume and leaves headroom.
- **Format:** CR80 (85.6 × 54 mm, 0.76mm) PVC — fits every wallet slot.
- **Printing:** owner QR code on the **back** (mandatory — the fallback for
  phones with NFC off, plus it makes the card self-explanatory), "Tap or scan"
  microcopy, swiftcard.me wordmark.
- **Lock the tag after writing** (permanent lock bit) for pre-programmed cards
  so a third party can't rewrite a customer's card to a malicious URL.

## 3. ⚠️ The URL decision (most important technical choice)

**Do NOT write the raw card URL (`swiftcard.me/card/aaron-menash`) onto a
permanent physical card.** We just shipped card-slug *renaming* — the moment a
customer renames their card, every physical card they've handed out dies.

**Write an indirection URL instead:** `swiftcard.me/t/<tagCode>`
- `<tagCode>` = short random code (8 chars) minted per physical card.
- A tiny `tags` table maps code → card id; `/t/[code]` 302-redirects to the
  card's **current** slug with `?source=nfc_card`.
- Survives renames, card re-assignment (owner switches which card the tag
  points to from settings), and even resale/re-issue.
- Bonus: per-tag analytics ("your conference card got 41 taps, your wallet
  card 12") — a feature none of the cheap competitors have.
- Build cost: one migration + one route + a small "My tap cards" settings
  section. ~half a day. (The self-serve writer shipped 2026-07-17 writes the
  raw URL with `?source=nfc_card` — fine for self-programmed hobby tags;
  the **sold** product should use `/t/` codes.)

## 4. Activation & fulfillment UX

**Phase 1 — pre-programmed (recommended launch):** cards arrive already
written + locked to `swiftcard.me/t/<code>`, with the QR printed to match.
Customer taps their own card once → `/t/<code>` shows a one-time **claim
screen** (sign in → "Link this card to: [pick your card]") → done. Zero-setup
out-of-box experience, and unclaimed cards are inert (no data leak).

**Phase 2 — self-programmed (already live):** the NFC writer in "Other ways to
share" lets Android users write their own blank tags today; iPhone users get
the guided NFC-app path. Keep as the free/DIY tier — it seeds demand for the
polished bought card.

## 5. Sourcing

- **Bulk manufacturers (China, best unit cost, 2–4 wk lead):**
  [nfcntag.com](https://nfcntag.com/custom-nfc-cards/) (MOQ 100, OEM printing),
  [rfidntag.com](https://www.rfidntag.com/nfc-ntag215-card/),
  [rfidfs.com](https://www.rfidfs.com/nfc-card). Expect roughly **$0.30–0.80/unit
  blank, $0.80–2 custom-printed** at 500+ (get 3 quotes; prices move).
- **Domestic/small-batch (fast, pricier, good for validation):**
  [Tagstand](https://www.tagstand.com/products/custom-small-batch-pvc-card-white-ntag215/)
  (no minimum), [GoToTags](https://store.gototags.com/nfc-tags/nfc-cards/custom-nfc-cards/),
  [TapTag](https://taptag.shop/pages/custom-bulk-orders).
- **Validation run:** 100 units, one matte-black core design, ~$150–300 all-in.
- Programming: suppliers can encode+lock from a CSV of `/t/` URLs we generate;
  or self-encode a first batch with an ACR122U USB writer (~$40) + free tools.

## 6. Selling it

- **Stripe product (physical goods)** — one-time price SKUs + a shipping
  address collection checkout. Physical goods are exempt from Apple IAP rules
  (Guideline 3.1.3(e)), so this is **allowed to be sold inside the iOS app
  too** — the one type of purchase that is. (Keep it native-gated OFF at launch
  anyway for simplicity; add later deliberately.)
- **Where it appears:** the "Other ways to share" NFC section ("Get a SwiftCard
  Tap card →"), a `/products/nfc-card` marketing page, post-signup upsell step,
  Office admin team-pack page.
- **Bundles:** free core card with annual Pro ($79/yr — card costs us ~$2,
  massively boosts annual conversion + retention: throwing away the card feels
  like cancelling); Office pack priced per-seat alongside seats.
- **Margin math @ $29 core:** landed cost ~$2 + $2 ship + $1.50 Stripe ≈ $5.50
  → **~80% gross margin.** 100 cards/mo ≈ $2,350/mo gross profit plus the
  subscription pull-through, which is the real prize.

## 7. Launch sequence

1. Build the `/t/<code>` redirect + claim flow + "My tap cards" settings (dev, ~1 day).
2. Design core card (front: bolt logo; back: QR + "Tap or scan").
3. Order 100-unit validation run from a small-batch supplier.
4. Stripe SKU + `/products/nfc-card` page + share-modal CTA.
5. Sell the first 100 manually (fulfill from home) → learn → then bulk order
   500–1000 from China and consider a fulfillment partner.

## 8. Risks / honest notes

- **Commodity product** — anyone can buy the same PVC cards. The moat is the
  claim flow + per-tag analytics + the SwiftCard dashboard behind the tap, not
  the plastic. Ship the `/t/` layer or there's no moat at all.
- Card **taps ≠ subscription revenue** by themselves; treat hardware as the
  acquisition/retention hook, not the business.
- Verify current supplier pricing before ordering — figures above are 2026
  market ranges, not quotes.

Sources: [Tagstand](https://www.tagstand.com/products/custom-small-batch-pvc-card-white-ntag215/) · [nfcntag.com](https://nfcntag.com/custom-nfc-cards/) · [rfidntag.com](https://www.rfidntag.com/nfc-ntag215-card/) · [GoToTags](https://store.gototags.com/nfc-tags/nfc-cards/custom-nfc-cards/) · [TapTag](https://taptag.shop/pages/custom-bulk-orders) · [rfidfs.com](https://www.rfidfs.com/nfc-card) · [Digital card pricing comparison 2026](https://blinq.me/blog/comparing-costs-of-digital-business-card-platforms) · [Mobilo vs Popl](https://lynkle.com/mobilo-vs-popl) · [Linq vs Popl](https://lynkle.com/linq-vs-popl)
