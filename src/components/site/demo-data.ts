import type { CardData } from "@/components/card-templates/types";

// Marketing demo cards — realistic, clearly fictional. Reused across the
// homepage and product sections so every showcase shows REAL card UI.

export const DEMO_CARD: CardData = {
  name: "Alex Morgan",
  title: "Founder & Principal",
  company: "Coastline Realty",
  phone: "(415) 555-0188",
  email: "alex@coastlinerealty.com",
  website: "coastlinehomes.com",
  address: "1200 Ocean Ave, San Francisco, CA",
  instagram: "@coastline.homes",
  linkedin: "in/alexmorgan",
  initials: "AM",
  photoUrl: "/marketing/demo-girl.jpg",
  logoUrl: null,
  cardUrl: "swiftcard.me/card/alexmorgan",
  customization: {
    accentColor: "#5D6BFF",
    about: "Helping people find the right home on the coast for 12 years.",
    links: [
      { label: "Book a viewing", url: "https://swiftcard.me" },
      { label: "See listings", url: "https://swiftcard.me" },
    ],
  },
};

export const DEMO_LINK_SOCIALS = [
  { label: "Instagram", href: "#", color: "#E1306C" },
  { label: "LinkedIn", href: "#", color: "#0A66C2" },
  { label: "Website", href: "#", color: "#5D6BFF" },
  { label: "YouTube", href: "#", color: "#FF0000" },
];

// Gallery variety — same sample person (Alex Morgan), different accents /
// templates / roles to show how one card looks across every design.
export const GALLERY = [
  { template: "photo-first", accent: "#5D6BFF", name: "Alex Morgan", title: "Founder & Principal", company: "Coastline Realty" },
  { template: "classic-pro", accent: "#0EA5A0", name: "Alex Morgan", title: "Creative Director", company: "Northlight Studio" },
  { template: "luxury-minimal", accent: "#B08D57", name: "Alex Morgan", title: "Partner", company: "Morgan & Co." },
  { template: "modern-bold", accent: "#F65B9E", name: "Alex Morgan", title: "Head of Growth", company: "Everbloom" },
] as const;
