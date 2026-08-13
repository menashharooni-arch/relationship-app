import { getSourceLabel } from "@/lib/source-labels";

// What the owner is told when someone touches their card.
//
// Pure, and separate from the ingest route, because this is the part with
// actual rules in it — which events are worth a notification, what each one is
// called, and how it reads when we don't know who the person is. The route
// around it is plumbing.

export type CardEventNotice = { type: string; title: string; body: string };

/**
 * The notification for one card event, or null when the event isn't news.
 *
 * `viewed_card` and `downloaded_vcard` are the two an owner cares about. Views
 * used to be excluded entirely — "not every view" — which is defensible for
 * anonymous traffic and wrong for the case that actually matters: you send
 * your card to someone and want to know they opened it.
 */
export function cardEventNotice(input: {
  eventType: string;
  visitorName?: string | null;
  source?: string | null;
  // Which page was opened — the links page now forwards real ?source=
  // attribution (a QR scan is a QR scan on either surface), so the surface is
  // its own signal rather than being inferred from source === "swift_links".
  surface?: "card" | "links" | null;
  // The event's own stored location — never re-derived, never another
  // visitor's. Absent means absent: the copy simply omits it, no guessing.
  location?: string | null;
}): CardEventNotice | null {
  const { eventType } = input;
  const name = (input.visitorName ?? "").trim();
  const source = input.source ?? null;
  const location = (input.location ?? "").trim();
  // Coarse city-level context makes the notification concrete ("near the
  // conference you're at") without claiming precision we don't have.
  const near = location ? ` near ${location}` : "";

  if (eventType === "viewed_card") {
    // Swift Links and the card are different surfaces and an owner shares them
    // for different reasons, so the notification says which one was opened.
    // source === "swift_links" kept for events from clients that predate the
    // explicit surface field.
    const surfaceLabel = input.surface === "links" || source === "swift_links"
      ? "your Swift Links"
      : "your card";
    return {
      type: "card_viewed",
      title: "Card viewed",
      // "Someone" when we genuinely don't know. A visitor is only named once
      // they have shared their details, so this never guesses at an identity.
      body: `${name || "Someone"} viewed ${surfaceLabel}${near}.`,
    };
  }

  if (eventType === "downloaded_vcard") {
    // The source is worth naming on a save (it tells the owner which QR, link
    // or NFC tag is working) but not on a view, where it is just noise on the
    // most frequent notification they get.
    const from = source && source !== "direct_link" ? ` from ${getSourceLabel(source)}` : "";
    return {
      type: "contact_saved",
      title: "Contact saved",
      body: `${name ? `${name} saved` : "Someone saved"} your contact card${from}${near}.`,
    };
  }

  return null;
}
