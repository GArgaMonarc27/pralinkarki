// ============================================
// SECTION 5: PROFILE INFORMATION
// Edit personal details here. Every page reads
// from this file, so change things once here.
// Fields set to null are not shown on the site
// until you fill them in.
// ============================================

export const profile = {
  name: "Pralin Karki",
  /** Used on the loading screen: "Initializing <firstName>'s World". */
  firstName: "Pralin",
  title: "Developer",
  tagline: "Web, desktop & 3D developer",
  /** Hero text under your name. */
  intro:
    "I build software for real businesses: booking systems, a personal finance app, a gold-loan ledger for a jewellery shop, and point-of-sale tooling.",
  /** About section paragraph. */
  about:
    "I'm a developer who likes building things people use at work every day. Most of my projects started with a real shop or business: a driving school that needed online bookings, a jewellery shop that needed its gold-loan ledger off paper, and store hardware that needed testing. I work across React and TypeScript front ends, serverless back ends on Supabase and Firebase, Python desktop tools, and Three.js.",
  /** Small line under About. Set to null if the 3D room isn't modelled on your own room. */
  roomNote: null as string | null,

  location: "Your City, Your Country",
  /** Used for search engines and share-card text. countryCode is the 2-letter ISO code. */
  place: { city: "Your City", region: "Your Region", country: "Your Country", countryCode: "NP" },
  /** Shown in the contact form's terminal title bar, e.g. "alex@kathmandu". */
  terminalHandle: "pralin@portfolio",

  /** Put your photo in public/images/ (portrait, about 680×850). */
  photo: "/images/profile.jpg",
  photoAlt: "Portrait of Pralin Karki",

  education: {
    college: "Your College",
    field: "Your Field of Study",
  },

  /** Set company to null if you don't want a Work card yet. */
  work: {
    company: "Your Company" as string | null,
    role: null as string | null, // e.g. "Frontend Developer"
    since: null as string | null, // e.g. "2025"
  },

  links: {
    github: "https://github.com/GArgaMonarc27",
    email: null as string | null,
    linkedin: null as string | null,
    resume: null as string | null,
  },

  /**
   * WhatsApp number in pieces: country code, then the local number split in
   * two. It's joined in the visitor's browser (see WhatsAppLink.tsx), so the
   * full number never appears in the page's HTML for scraper bots to read.
   * Set to null to remove WhatsApp from the site.
   */
  whatsapp: null as { country: string; parts: string[] } | null,
} as const;
