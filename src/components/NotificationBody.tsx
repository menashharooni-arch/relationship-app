import { GateCopy } from "@/components/PlanGate";
import { splitLocationParts } from "@/lib/location-privacy";

// The body line of a notification, with the place a view came from blurred.
//
// The blur is NOT the lock. By the time a body reaches this component on a Free
// account the place name is already gone — the server replaced it with blocks
// (lib/notification-privacy.ts), so there is nothing to read in devtools and
// nothing to copy out. This is what makes that redaction look deliberate
// instead of broken: the sentence keeps its shape, with a soft smudge where the
// town was.
//
// Nothing here mentions Pro, upgrading or price (owner, 2026-09-11: "Don't say
// anything about pro or upgrading. It should just blur the location name.") —
// and on a paid account the marks are stripped upstream, so every part comes
// back as ordinary text and this renders exactly what it always did.
export default function NotificationBody({ text }: { text: string }) {
  const parts = splitLocationParts(text);

  return (
    <>
      {parts.map((part, i) =>
        part.place ? (
          <BlurredPlace key={i} text={part.text} />
        ) : (
          <GateCopy key={i} copy={part.text} />
        ),
      )}
    </>
  );
}

/**
 * The smudge itself, shared.
 *
 * Used by the notification list and by the contacts detail panel, so the one
 * place a Free account meets a withheld location looks the same in both. The
 * text handed in is already blocks — see lib/location-privacy — so there is
 * nothing readable underneath the blur.
 */
export function BlurredPlace({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center align-baseline">
      {/* aria-hidden: a screen reader must not read out a row of blocks. */}
      <span aria-hidden className="select-none pointer-events-none blur-[3px] opacity-70 tracking-tight">
        {text}
      </span>
      <span className="sr-only">location hidden</span>
    </span>
  );
}
