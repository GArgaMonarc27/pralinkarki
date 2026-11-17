// ============================================
// SECTION 5: PROJECT INFORMATION
// Edit project details here. Only facts you
// have confirmed belong in this file.
// Every field set to null or [] is hidden on the
// site, so a missing detail never shows up as a
// placeholder. Fill them in as you confirm them.
// ============================================

/**
 * Which animated 3D scene the project card shows: a scanned leaf, a tee on a
 * hanger, rising bars with a coin, boxes stacking on shelves, a car on a road,
 * gold on a scale, a receipt printer, or a network rack.
 */
export type ProjectVisual = "leaf" | "tee" | "chart" | "boxes" | "car" | "gold" | "printer" | "rack";

export type Project = {
  slug: string;
  visual: ProjectVisual;
  title: string;
  subtitle: string;
  /** One or two sentences: what it is and what it does. */
  summary: string;
  /** Case study: the problem it addresses. */
  problem: string | null;
  /** Case study: how it solves that problem. */
  solution: string | null;
  /** Your part in it, e.g. "Solo project: model training and web app". */
  role: string | null;
  /** e.g. "2025" */
  year: string | null;
  features: string[];
  stack: string[];
  repo: string | null;
  live: string | null;
  /** Screenshots in /public/projects/<slug>/, e.g. "/projects/claros-finance/payday.png". */
  screenshots: Array<{ src: string; alt: string }>;
};

export const projects: Project[] = [
  {
    slug: "claros-finance",
    visual: "chart",
    title: "Claros Finance",
    subtitle: "Personal Finance App",
    summary:
      "A personal finance tracker for people in Australia: payday planning, bank CSV import, expense tracking and cloud sync.",
    problem:
      "Budgeting apps show where money went. They don't help much on payday, when you need to decide what each dollar is for before it's spent.",
    solution:
      "Payday GPS takes the pay that actually landed and gives every dollar a job across bills, everyday spending, goals, money sent home and flex, protecting essentials first and reconciling to the cent. Money Outlook starts from a confirmed balance and projects the next 35 days.",
    role: null,
    year: "2026",
    features: [
      "Payday GPS: splits each pay across bills, spending, goals and money sent home",
      "Money Outlook: 35-day balance projection from a confirmed balance",
      "SafeSend: checks how much can safely be sent home",
      "Bank CSV import and onboarding snapshot",
      "Lend/borrow tracking, goals and subscriptions",
      "End-of-financial-year export for an accountant",
    ],
    stack: ["JavaScript", "HTML & CSS", "Chart.js", "Vercel serverless functions", "Supabase (Postgres)", "JWT auth"],
    repo: null,
    live: "https://finance-ashen-xi.vercel.app",
    screenshots: [],
  },
  {
    slug: "bakery-network-simulator",
    visual: "rack",
    title: "Bakery Network Simulator",
    subtitle: "Interactive 3D Training Tool",
    summary:
      "A 3D walk-through of a bakery store's network, from the NBN connection to the rack, switches and point-of-sale devices, with guided steps for cabling it up.",
    problem: null,
    solution: null,
    role: null,
    year: "2026",
    features: [
      "3D model of the store's back-of-house network and front-of-house devices",
      "Guided, step-by-step cabling instructions",
      "Device and port details, VLAN layout",
      "Camera presets to jump between areas",
    ],
    stack: ["React", "TypeScript", "Three.js", "React Three Fiber", "Zustand", "Vite"],
    repo: null,
    live: null,
    screenshots: [],
  },
  {
    slug: "amy-safe-driving-school",
    visual: "car",
    title: "Amy's Safe Driving School",
    subtitle: "Booking Website",
    summary:
      "Website and online booking system for a Melbourne driving school, with a student dashboard and a mobile-friendly owner portal.",
    problem: null,
    solution: null,
    role: null,
    year: "2026",
    features: [
      "Online lesson, trial and exam-day booking",
      "Student accounts and dashboard",
      "Owner portal: bookings, calendar, blocked time and students",
      "Package price editor with draft, preview and publish",
    ],
    stack: ["React", "TypeScript", "Vite", "Tailwind CSS", "shadcn/ui", "Firebase", "Netlify"],
    repo: null,
    live: "https://amysafedrivingschool.com.au",
    screenshots: [],
  },
  {
    slug: "gorkhali-sun-chandi-pasal",
    visual: "gold",
    title: "Gorkhali Sun Chandi Pasal",
    subtitle: "Gold-Loan Ledger",
    summary:
      "A ledger for a gold and silver shop that lends cash against pledged gold: customer folios, loan records and item photos, replacing paper books.",
    problem: null,
    solution: null,
    role: null,
    year: "2026",
    features: [
      "Customer folios with contacts and searchable history",
      "Loan records: item, date, amount lent, weight in tola and gold rate",
      "One photo per item, compressed in the browser and stored privately",
      "Each shop login sees only its own ledger",
    ],
    stack: ["JavaScript", "HTML & CSS", "Supabase (Auth, Postgres, Storage)", "Cloudflare Pages Functions", "Google Drive API"],
    repo: null,
    live: null,
    screenshots: [],
  },
  {
    slug: "pos-diagnostic-tool",
    visual: "printer",
    title: "POS Diagnostic Tool",
    subtitle: "Desktop Hardware Tester",
    summary:
      "A Windows desktop app for checking point-of-sale hardware: receipt printers, barcode scanners, cash drawers and ports, with a log of every test.",
    problem: null,
    solution: null,
    role: null,
    year: "2026",
    features: ["Receipt printer tests", "Barcode scanner tests", "Cash drawer tests", "Port checks and test logs"],
    stack: ["Python", "PySide6 (Qt)", "PyInstaller"],
    repo: "https://github.com/GArgaMonarc27/pos_diagnoastic_tool",
    live: null,
    screenshots: [],
  },
];

export const projectBySlug = (slug: string) => projects.find((p) => p.slug === slug);
