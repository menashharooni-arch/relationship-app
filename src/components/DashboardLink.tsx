"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const ACTIVE_CARD_KEY = "swiftcard_active_card";

// Resolve the dashboard target for the CURRENTLY SELECTED card. Priority:
//   1. an explicit `card` (a page that already knows its card, e.g. the editor)
//   2. the ?card= on the current URL
//   3. the last card the user actually viewed, persisted in localStorage by
//      CardSelectionPersist on the dashboard
//   4. the bare dashboard (brand-new users who've never opened a card)
function resolveHref(card?: string | null): string {
  if (card) return `/dashboard?card=${encodeURIComponent(card)}`;
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("card");
    const found = fromUrl || localStorage.getItem(ACTIVE_CARD_KEY);
    if (found) return `/dashboard?card=${encodeURIComponent(found)}`;
  } catch {
    /* storage/URL blocked — fall back to the bare dashboard */
  }
  return "/dashboard";
}

// A "Dashboard" link that returns the user to the dashboard for the currently
// selected card, instead of the bare /dashboard (which lands on the card picker
// with nothing selected). SSR renders the explicit/bare href; the persisted
// card is filled in right after hydration, and re-resolved at click time so it
// is always the freshest value even if the selection changed after mount.
// Kept in one place so every "Dashboard" link behaves identically (mirrors the
// resolution MobileNav already uses for its Home tab).
export default function DashboardLink({
  card,
  className,
  children,
  ...rest
}: {
  card?: string | null;
  className?: string;
  children: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<typeof Link>, "href" | "className" | "children">) {
  const router = useRouter();
  const [href, setHref] = useState<string>(card ? `/dashboard?card=${encodeURIComponent(card)}` : "/dashboard");

  useEffect(() => {
    setHref(resolveHref(card));
  }, [card]);

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    // Let modified clicks (new tab, etc.) use the rendered href.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    const fresh = resolveHref(card);
    if (fresh !== href) {
      e.preventDefault();
      setHref(fresh);
      router.push(fresh);
    }
  }

  return (
    <Link href={href} className={className} onClick={handleClick} {...rest}>
      {children}
    </Link>
  );
}
