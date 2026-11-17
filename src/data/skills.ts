// ============================================
// SECTION 5: SKILLS
// Edit your skills here. `about` says what the
// tool is. `usedIn` lists project slugs (from
// projects.ts) where you've confirmed using it;
// add more as you fill in project stacks.
// ============================================

export type SkillCategory = "Frontend" | "Backend" | "Database" | "Tools";

export type Skill = {
  name: string;
  category: SkillCategory;
  about: string;
  usedIn: string[];
};

export const skillList: Skill[] = [
  { name: "React", category: "Frontend", about: "JavaScript library for building interfaces out of reusable components.", usedIn: ["amy-safe-driving-school", "bakery-network-simulator"] },
  { name: "TypeScript", category: "Frontend", about: "JavaScript with types, which catch mistakes before the code runs.", usedIn: ["amy-safe-driving-school", "bakery-network-simulator"] },
  { name: "JavaScript", category: "Frontend", about: "The language of the web, for interactivity in the browser.", usedIn: ["claros-finance", "gorkhali-sun-chandi-pasal"] },
  { name: "Tailwind CSS", category: "Frontend", about: "Utility-first CSS framework for styling directly in markup.", usedIn: ["amy-safe-driving-school"] },
  { name: "Three.js", category: "Frontend", about: "3D graphics in the browser; React Three Fiber brings it into React.", usedIn: ["bakery-network-simulator"] },
  { name: "Node.js", category: "Backend", about: "JavaScript on the server, here as serverless API functions.", usedIn: ["claros-finance"] },
  { name: "Python", category: "Backend", about: "General-purpose language, used here for desktop tools and automation.", usedIn: ["pos-diagnostic-tool"] },
  { name: "Supabase", category: "Database", about: "Postgres database with built-in auth, file storage and row-level security.", usedIn: ["claros-finance", "gorkhali-sun-chandi-pasal"] },
  { name: "Firebase", category: "Database", about: "Google's app platform: auth, Firestore database and cloud functions.", usedIn: ["amy-safe-driving-school"] },
  { name: "GitHub", category: "Tools", about: "Version control, code hosting and collaboration.", usedIn: [] },
  { name: "Vercel & Netlify", category: "Tools", about: "Hosting for web apps and serverless functions, deployed from Git.", usedIn: ["claros-finance", "amy-safe-driving-school"] },
  { name: "Blender", category: "Tools", about: "3D modelling software for building scenes and assets.", usedIn: [] },
];

export const SKILL_CATEGORIES: SkillCategory[] = ["Frontend", "Backend", "Database", "Tools"];

/** Skills grouped by category, in the order above. */
export const skills = Object.fromEntries(
  SKILL_CATEGORIES.map((c) => [c, skillList.filter((s) => s.category === c).map((s) => s.name)]),
) as Record<SkillCategory, string[]>;
