import type { CardData } from "@/components/card-templates/types";

// Marketing demo cards — realistic, clearly fictional. Reused across the
// homepage and product sections so every showcase shows REAL card UI.

export const DEMO_CARD: CardData = {
  name: "Alex Morgan",
  title: "Founder & CEO",
  company: "Morgan & Co.",
  phone: "(555) 123-4567",
  email: "alex@morganandco.com",
  website: "www.morganandco.com",
  address: "123 Main Street, New York, NY",
  instagram: "@morganandco",
  linkedin: "in/alexmorgan",
  initials: "AM",
  photoUrl: "/marketing/demo-girl.jpg",
  logoUrl: null,
  cardUrl: "swiftcard.me/card/alexmorgan",
  customization: {
    accentColor: "#5D6BFF",
    about: "Helping brands grow with sharp strategy for 12 years.",
    links: [
      { label: "Book a call", url: "https://swiftcard.me" },
      { label: "See our work", url: "https://swiftcard.me" },
    ],
  },
};

export const DEMO_LINK_SOCIALS = [
  { label: "Instagram", href: "#", color: "#E1306C" },
  { label: "LinkedIn", href: "#", color: "#0A66C2" },
  { label: "Website", href: "#", color: "#5D6BFF" },
  { label: "YouTube", href: "#", color: "#FF0000" },
];

// Gallery variety — the SAME person and business everywhere on the site
// (owner decision, Jul 2026): only the accent/template changes per tile.
export const GALLERY = [
  { template: "photo-first", accent: "#5D6BFF", name: "Alex Morgan", title: "Founder & CEO", company: "Morgan & Co." },
  { template: "classic-pro", accent: "#0EA5A0", name: "Alex Morgan", title: "Founder & CEO", company: "Morgan & Co." },
  { template: "luxury-minimal", accent: "#B08D57", name: "Alex Morgan", title: "Founder & CEO", company: "Morgan & Co." },
  { template: "modern-bold", accent: "#F65B9E", name: "Alex Morgan", title: "Founder & CEO", company: "Morgan & Co." },
] as const;
