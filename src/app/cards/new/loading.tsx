import PortalSkeleton from "@/components/PortalSkeleton";

// This route had NO loading boundary, and in the App Router that means no
// Suspense — so `router.push` BLOCKED on the server until the whole RSC payload
// was ready. The dashboard stayed fully on screen, tab bar and all, looking
// interactive, for as long as the page's queries took (this one runs up to six
// sequential round trips before it returns any markup). Nothing indicated the
// tap had registered, then the screen swapped at once. That is the literal
// "I pressed Add card and nothing happened".
//
// A boundary also makes the route PREFETCHABLE — Next does not prefetch a
// dynamic route that has no loading state — so the payload is often already in
// flight before the tap.
//
// variant="form": the wizard/editor is a single column of fields at max-w-4xl,
// not the dashboard's 2-column card grid. A skeleton of the wrong shape just
// trades a frozen screen for a reflow when the real content lands.
export default function Loading() {
  return <PortalSkeleton variant="form" />;
}
