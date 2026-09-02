import { defineDocs } from "../types";

// Building and editing a card.
//
// The old assistant had the wizard's steps 2 and 3 swapped, claimed the editor
// had two tabs when it has four, and named a "Design" tab that is actually
// called "Card design" — so its most-asked-for answer sent people to a tab
// that doesn't exist. Every label below is the one in the JSX.

export const cardDocs = defineDocs([
  {
    id: "create-a-card",
    title: "Creating a card",
    audience: ["user"],
    triggers: [
      "create a card", "make a card", "new card", "add card", "add a card", "create my card",
      "first card", "set up a card", "build a card", "another card",
    ],
    answer:
      "From the dashboard's \"My Cards\" box, press \"Add card\" (or \"Create your card →\" if you don't have one yet). It's a four-step builder: 1 Card information, 2 Card design, 3 Socials, 4 Social design — then you're done and the card is live.",
    detail:
      "Step by step, with the real headings: step 1 \"New card\" — name, title, phone numbers, email, website and address, ending in \"Next: Card design →\". Step 2 \"Card design\" — \"Add your logo and headshot, then pick a design.\" — logo, headshot, template and colours, ending in \"Next: Socials →\". Step 3 \"Socials\" — bio, social profiles and additional link buttons, ending in \"Next: Social design →\". Step 4 \"Social design\" — the look of your Swift Links page: pick a Look, choose the \"Page header\" (full cover photo, short banner, compact circle, or no header) and what it shows (headshot, logo, initials, or a photo you upload just for the header), and style your social icons and link buttons. A guest building their first card then picks a plan and creates an account; an existing user's card just goes live.",
  },
  {
    id: "edit-a-card",
    title: "Editing a card",
    audience: ["user"],
    triggers: [
      "edit a card", "edit card", "edit my card", "update my card", "change my info",
      "change my name", "change my phone", "change my email", "change my number",
      "change my title", "fix my card", "where do i edit",
    ],
    answer:
      "Settings → Cards and sharing → \"Edit\" next to the card. That's the only place a card can be edited — the dashboard shows and shares cards but has no Edit link. The editor has four tabs: \"Card info\", \"Card design\", \"Socials\" and \"Social design\".",
    detail:
      "What lives on each tab, from their own hints: Card info — \"Name & contact details\" (plus your website, address, and the card's URL). Card design — \"Photos, template, colors & fonts\". Socials — \"Bio, socials & additional links\". Social design — \"Style your Swift Links page\". Social design also has a \"Show the 'View SwiftCard' button\" switch — on by default; turning it off removes the small link at the bottom of the Swift Links page that opens the card. The tab also offers a \"Page header\" choice — \"Cover photo\" (the classic full photo), \"Short banner\" (a third of the screen), \"Compact circle\" (a small round photo) or \"No header\" (one flat page) — plus a \"Header shows\" pick: \"Auto\" (headshot, else logo, else initials), \"Headshot\", \"Logo\", \"Initials\" or \"Upload photo\" (a photo uploaded just for the header — all of this on any plan) — and, with Pro, a \"Link buttons\" row style: \"Standard\" (the stock translucent rows), \"Solid\" (solid color rows) or \"Outline\" (bordered rows), plus a button color picker. This styles only the plain compact rows — links set to \"Featured\" or \"Grid\" on the Socials tab always keep their big image previews (that's how video previews stay visible). Note the second tab is labelled \"Card design\", not \"Design\". On a team account the company-managed fields show a \"Managed by your organization\" tag and can't be changed from here.",
  },
  {
    id: "templates-and-design",
    title: "Templates, colours and fonts",
    audience: ["user"],
    triggers: [
      "design", "template", "templates", "change design", "change template",
      "change my design", "theme", "fonts", "colors", "colours", "card look", "restyle",
    ],
    answer:
      "Settings → Cards and sharing → Edit → the \"Card design\" tab. There are {product.templateCount} templates — Classic Pro, Modern Bold, Photo First, Local Business, Luxury Minimal and Logo First — and every one of them is available on every plan. Pick one, then restyle its background, name colour, details colour, accent and font from the curated swatches below it.",
    detail:
      "Free accounts can restyle a template using the same curated swatches Pro sees; what Pro adds is the free-form colour picker and the Custom design path. The marketing site calls the first template \"Classic Professional\" while the editor calls it \"Classic Pro\" — same design. Changing a template never changes your card's URL or content.",
  },
  {
    id: "custom-designer",
    title: "Custom design (Pro)",
    audience: ["user"],
    triggers: [
      "custom design", "custom designer", "design my own", "drag and drop", "move things",
      "rebuild my card", "copy my printed card", "scan my card design", "my existing card design",
    ],
    answer:
      "In the \"Card design\" tab, above the templates, there's a \"Custom design\" option marked PRO: eight looks you can't pick as a template, or photograph the printed card you already have and it gets rebuilt for you. From there you can show, hide, reorder and resize anything on the card.",
    detail:
      "Inside the designer the button for the photo route reads \"Copy a card or template you like\" — upload a picture of a card and it is measured and rebuilt with your own details on it. Like the rest of the custom designer it is Pro; a Free account gets a clear refusal rather than a silent failure. This is the one genuinely Pro-only design path — the templates themselves are not gated. If an account drops to Free, a custom-designed card falls back to the nearest standard template; the layout is not deleted, and it returns when the account is paid again.",
  },
  {
    id: "photos",
    title: "Logo and headshot",
    audience: ["user"],
    triggers: [
      "logo", "headshot", "photo", "profile picture", "upload image", "upload photo",
      "company logo", "picture", "avatar", "crop", "change my photo",
    ],
    answer:
      "Both are on the \"Card design\" tab (step 2 of the builder): \"Upload your company logo\" and \"Upload your headshot\". No photo handy? \"Suggest my profile picture\" pulls one from your connected accounts for you to preview, and there's a matching suggestion for your company logo.",
    detail:
      "The headshot note says it plainly: \"Recommended. This will also be used for your SwiftLink.\" Each card has its OWN headshot — a card without one will not borrow another card's. The logo adapts to its own shape (square, wide, or banner), and a \"Logo shape\" toggle under the upload adds a Circle option — your full logo inside a clean circular badge, nothing cropped. On a team account the company logo is set by the admin on the Branding tab and can't be uploaded by a member.",
  },
  {
    id: "socials",
    title: "Social profiles and extra links",
    audience: ["user"],
    triggers: [
      "social", "socials", "instagram", "linkedin", "tiktok", "facebook", "youtube",
      "twitter", "snapchat", "add socials", "add a link", "extra links", "buttons", "bio",
    ],
    answer:
      "The \"Socials\" tab (step 3 of the builder) — your bio, your social profiles, and additional link buttons. Each field shows the format it wants: LinkedIn as linkedin.com/in/you, Facebook as facebook.com/you, YouTube as youtube.com/@you, and Instagram, TikTok, X and Snapchat as an @handle.",
    detail:
      "These all appear on your Swift Links page, and the socials also show on your card page. Additional links take a name and a URL — Free shows the first {limit.links} of them publicly and keeps any extras stored but hidden, so they reappear if the account becomes paid.",
  },
  {
    id: "card-url",
    title: "Changing your card's link",
    audience: ["user"],
    triggers: [
      "card url", "change my url", "change my link", "username", "handle", "custom url",
      "vanity url", "my link", "rename my link",
    ],
    answer:
      "On the \"Card info\" tab of the card editor — your card lives at swiftcard.me/<your-url>. The URL is YourName-YourCompany (for example swiftcard.me/AaronLavi-MalveCapital, any capitalization works) and it updates ITSELF when you change the card's name or company \u2014 links and QR codes you already shared keep working, they redirect to the new URL. The editor on the Card info tab is only needed if you want a fully custom ending; a custom URL never changes on its own.",
    detail:
      "Changing it breaks anything already pointing at the old address: printed QR codes, NFC cards already written, and links you've shared. The QR and the NFC tag store the link, so they need re-writing or reprinting after a change. Your Swift Links page uses the same ending, so both move together.",
  },
  {
    id: "delete-a-card",
    title: "Deleting a card",
    audience: ["user"],
    triggers: ["delete a card", "delete card", "remove a card", "get rid of a card", "delete my card"],
    answer:
      "Settings → Cards and sharing → \"Delete\" on the card, then confirm in the red panel that appears. Be careful: deleting a card also permanently deletes every contact that card captured, along with their message history.",
    detail:
      "Export the contacts first if there's any chance they're wanted — there is no undo. If the goal is just to take the card out of circulation rather than lose the data, there isn't a self-serve \"hide\" switch on a personal account; on a team account an admin can take a card offline instead.",
  },
]);
