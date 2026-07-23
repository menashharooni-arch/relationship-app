import type { Metadata } from "next";

// The templates page itself is a client component (interactive gallery), so its
// metadata lives here.
export const metadata: Metadata = {
  title: "Templates — SwiftCard",
  description:
    "Designer templates for your SwiftCard digital business card — your colors, photo, and logo, with a scannable QR and Save Contact button built in.",
};

export default function TemplatesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
