"use client";

// Makes a card preview strictly look-only.
//
// Every card template renders REAL interactive chrome — tel:/mailto: links,
// social buttons, action links, the QR. That's exactly right on a published
// card, but inside an editor it's a trap: tapping your own phone number starts
// a call, tabbing wanders into links that go nowhere useful, and a stray click
// feels like it should edit the thing you clicked. Design changes belong to the
// editor's own controls, so the preview must be a picture, not a page.
//
// `inert` is the whole job in one attribute: the subtree can't be clicked,
// focused, tabbed into, or activated by keyboard, and it's dropped from the
// accessibility tree (correct here — every value shown is already announced by
// the form field that owns it, so exposing it twice is noise). `pointer-events`
// and `user-select` are belt-and-braces for older engines that ship one but not
// the other, and they also stop the text-selection smear when dragging near it.
//
// Applies to EDITOR previews only. The published card at /card/[username] and
// the Swift Links page render the same templates WITHOUT this wrapper, so their
// phone, email, buttons and links keep working normally.
export default function InertPreview({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      inert
      aria-hidden="true"
      data-preview-locked="true"
      className={className}
      style={{ pointerEvents: "none", userSelect: "none", WebkitUserSelect: "none" }}
    >
      {children}
    </div>
  );
}
