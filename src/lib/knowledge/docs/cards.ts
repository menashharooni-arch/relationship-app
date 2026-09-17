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
      "Step by step, with the real headings: step 1 \"New card\" — name, title, phone numbers, email, website and address, ending in \"Next: Card design →\". Step 2 \"Card design\" — \"Add your logo and headshot, then pick a design.\" — logo, headshot, template and colours, ending in \"Next: Socials →\". Step 3 \"Socials\" — bio, social profiles and additional link buttons, ending in \"Next: Social design →\". Step 4 \"Social design\" — the look of your Swift Links page: pick a Look from the three groups (Solid, Gradient, Glass), choose the \"Page header\" (full cover photo, short banner, compact circle, or no header) and what it shows (headshot, logo, initials, or a photo you upload just for the header), set the page background (a colour, or with the compact circle a photo or video behind the whole page), and style your social icons and link buttons. A guest building their first card then picks a plan and creates an account; an existing user's card just goes live.",
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
      "What lives on each tab, from their own hints: Card info — \"Name & contact details\" (plus your website, address, and the card's URL). Card design — \"Photos, template, colors & fonts\" (laid out as Logo & headshot, Template, Look, Fine-tune and More style options). Socials — \"Bio, socials & additional links\". Social design — \"Style your Swift Links page\". Social design also has a \"Show the 'View SwiftCard' button\" switch — on by default; turning it off removes the small link at the bottom of the Swift Links page that opens the card. The Social design tab is laid out in two parts: \"The page\" (Look, Page background, Text color, Font) and \"On the page\" (Page header, Social icons, Connect button, Link buttons) — the second group runs in the order visitors see them down the page. It also offers a \"Page header\" choice — \"Cover photo\" (the classic full photo), \"Short banner\" (a third of the screen), \"Compact circle\" (a small round photo) or \"No header\" (one flat page) — plus a \"Header shows\" pick: \"Auto\" (headshot, else logo, else initials), \"Headshot\", \"Logo\", \"Initials\" or \"Upload photo\" (a photo uploaded just for the header — all of this on any plan) — and, with Pro, a \"Link buttons\" section that lists every additional link so each one can be styled on its own: pick \"Featured\" (full-width tile), \"Grid\" (half-width pairs) or \"Compact\" (slim row) per link. For Featured and Grid, the tile shows the link's own preview image, or \"Upload photo or video\" swaps in your own photo or a short video (up to 25 MB, plays muted); \"Use link preview\" goes back. For Compact, a \"Row style\" of \"Standard\" (the stock translucent row), \"Solid\" (solid color) or \"Outline\" (bordered) appears, plus one shared button color picker for Solid/Outline rows, which defaults to your Connect button color. A \"Connect button\" section sets that action color: it changes the Connect button and any social icons set to Accent, and Solid/Outline rows follow it unless given their own. Leave it on Default to use the Look\u2019s own color. Pro. Below that, \"Page background\" sets the surface behind everything: a colour swatch on any header, and — ONLY when the Page header is \"Compact circle\" — an \"Add\" button (\"Edit\" and \"Remove\" once one is set) that fills the whole page with a photo or a short video. With one set, a \"Darken\" slider controls how much it is dimmed for readability, and a \"Blur the link buttons\" switch turns the plain rows into frosted glass; both are Pro. Choosing a different Page header hides the background but keeps it — switch back to Compact circle and it returns. One page can mix all three — for example one Featured video, two Grid tiles and a Compact row. The links themselves are added and removed on the Socials tab, which has no style controls. Note the second tab is labelled \"Card design\", not \"Design\". On a team account the company-managed fields show a \"Managed by your organization\" tag and can't be changed from here. On the Free plan every one of these controls WORKS — pick any Look, any colour, any icon or button style and the live preview shows it, so you can see the page you would have. The parts that need Pro carry a small PRO tag, and pressing \"Save Changes\" is where it stops: a panel lists exactly what you used that needs Pro and offers to save the free version of the page instead. Nothing is silently thrown away, and nothing is locked before you have seen it — the same way Card design works.",
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
      "Settings → Cards and sharing → Edit → the \"Card design\" tab. There are {product.templateCount} templates — Classic Pro, Modern Bold, Photo First, Local Business, Luxury Minimal and Logo First — and every one of them is available on every plan. The tab runs top to bottom: \"Logo & headshot\" (a row that opens by itself while either is missing, and folds to a one-line summary once both are added — tap it to change them), then \"Template\", a gallery where every template is drawn with your own name and details so you can see each one before you pick it (\"Custom design\" is the slim row under them). Below that the style panel runs in three parts. \"Look\" comes first — one tap sets the whole card; the first tile, \"Original\", puts the template back exactly as it ships (its own colours, font and finish). Then \"Fine-tune\", with three buttons that show one group at a time: \"Colours\" (the background, the second panel where a template has one, your name colour, and the accent — which colours the icons on your card AND the buttons on your card page), \"Font\", and \"Finish\". A small dot on Colours or Finish means a Pro choice is in use inside it. The two least-used controls — the details colour and the panel photo or video — sit under a \"More style options\" row you tap to open; nothing is removed, it is just folded away. On a phone, once you scroll past the card preview a small copy of the card stays at the top of the screen, so you can watch every change. \"Finish\" is the material laid over your colour: Flat (the standard look), Sheen (a band of light), Halo (a glow behind your logo), Frosted (a milky sheet), Brushed metal, Carbon, Linen and Gilt edge (a foil rule). Flat, Sheen and Halo are on every plan; the other five come with Pro. A finish reads strongest on deeper colours, and Frosted lightens the panel, so the editor warns that a white name may need a darker colour. Inside \"More style options\", \"Photo or video\" (Pro) puts a photo or a short video behind that same surface, with a \"Darken\" slider so your name stays readable. A video plays on your live card page; everywhere a video cannot play — the card image you download or share, link previews, and your email signature — its first frame is shown instead, so the card never looks empty. Finishes work on all six templates and change nothing on a card that has not picked one.",
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
      "In the \"Card design\" tab, directly under the template gallery, there's a \"Custom design\" row marked PRO: eight looks you can't pick as a template, or photograph the printed card you already have and it gets rebuilt for you. From there you can show, hide, reorder and resize anything on the card.",
    detail:
      "Inside the designer the button for the photo route reads \"Copy a card or template you like\" — upload a picture of a card and it is measured and rebuilt with your own details on it. Like the rest of the custom designer it is Pro; a Free account gets a clear refusal rather than a silent failure. This is the one genuinely Pro-only design path — the templates themselves are not gated. A custom card made with the earlier version of the designer (before August 2026) is shown exactly as it was saved, with a \"Convert to edit\" button — nothing about it changes until you press that, and you can Undo the conversion before saving. If an account drops to Free, a custom-designed card falls back to the nearest standard template; the layout is not deleted, and it returns when the account is paid again.",
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
      "Both are on the \"Card design\" tab (step 2 of the builder): \"Upload your company logo\" and \"Upload your headshot\". No photo handy? \"Suggest my profile picture\" pulls one from your connected accounts for you to preview, and there's a matching suggestion for your company logo. If it offers \"Connect LinkedIn\", connecting brings you straight back and applies your LinkedIn photo automatically — you'll see \"Headshot added\", and you can still upload your own to replace it. On a computer a small LinkedIn window opens on top and closes itself when you're done; in the app it opens as a sheet over your card. Either way the card you were editing stays open behind it and keeps everything you had typed — you do not have to save first.",
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
      "The \"Socials\" tab (step 3 of the builder) — your bio, your social profiles, and additional link buttons. Every social box asks for the same thing: just your username. Under each one it says what that becomes — \"Just your username — becomes linkedin.com/in/alexmorgan\", and the same for instagram.com/, tiktok.com/@, facebook.com/, x.com/, snapchat.com/add/ and youtube.com/@. Pasting a full profile URL still works; once a box is filled it shows the exact address it opens, so a wrong handle is visible before anyone taps it.",
    detail:
      "These all appear on your Swift Links page, and the socials also show on your card page. Additional links take a name and a URL — Free shows the first {limit.links} of them publicly and keeps any extras stored but hidden, so they reappear if the account becomes paid.",
  },
  {
    id: "page-background",
    title: "A photo or video behind your Swift Links page",
    audience: ["user"],
    triggers: [
      "background", "page background", "background photo", "background video",
      "video background", "photo behind my links", "wallpaper", "background image",
      "blurry buttons", "blurred buttons", "frosted", "glass buttons", "see through buttons",
    ],
    answer:
      "Card editor → Social design → set \"Page header\" to \"Compact circle\", then use \"Add\" under \"Page background\" to upload a photo or a short video. It fills the whole page behind your links. Photos up to 5 MB, videos up to 25 MB — the video plays muted and loops on its own.",
    detail:
      "The buttons only appear with the Compact circle header. The other headers (Cover photo, Short banner, No header) already lead with a big photo at the top, so a second full-page image would fight it — pick a background colour there instead. Two controls appear once a background is set. \"Darken\" dims the photo so your name and links stay readable; nudge it up if a bright photo is washing out the text. \"Blur the link buttons\" turns the plain rows into frosted glass that your background shows softly through — it is on by default when you add a background, and it makes a real difference over a busy photo. Both are Pro, along with the background itself. If you change the Page header afterwards the background is kept, not deleted: the editor says so, and switching back to Compact circle brings it straight back. Over a background your name and link labels are shown in white automatically, unless you picked a text colour yourself. Portrait shots fit best — the picture is cropped to fill the page, so a wide landscape photo shows only its middle on a phone.",
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
