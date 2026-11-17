# Pralin Karki — Interactive 3D Portfolio

Next.js (App Router) + TypeScript + Tailwind CSS v4 + React Three Fiber. A low-poly Himalayan trek at dusk: a trail climbs from a teahouse (About) past a stupa (Skills), a monastery (Education) and a suspension bridge (Work) to base camp (Projects) and the summit (Contact), each clickable, project gallery with case-study pages, a 3D skills orbit, About, and Contact with a working email form.

## Run it

Needs Node.js 20 or newer.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production check
```

## Make it yours (in this order)

1. `src/data/profile.ts`: name, intro, about text, location, education, work, links, WhatsApp.
2. `public/images/profile.jpg`: replace the placeholder with your portrait (about 680×850).
3. `src/data/projects.ts`: one entry per project. `slug` becomes the URL (`/projects/<slug>`); `visual` picks the 3D card scene. Empty fields (`null` / `[]`) are hidden on the site.
4. `src/data/skills.ts`: your skills; put project slugs in `usedIn`.
5. `src/app/globals.css` SECTION 1: change `--color-accent` and fonts so the site doesn't look identical to the original.

Anything set to `null` is hidden until you fill it in.

### Turn on the contact form (about 5 minutes, free)

1. Sign up at **resend.com** with the email address where you want messages to arrive.
2. In Resend, go to **API Keys → Create API Key**, and copy it.
3. In Vercel, open your project → **Settings → Environment Variables**, and add:
   - `RESEND_API_KEY` = the key you copied
   - `CONTACT_TO_EMAIL` = the email you signed up to Resend with
4. **Redeploy** (Deployments → ⋯ → Redeploy). The form appears.

Without your own domain, Resend's test sender can only deliver to the email you signed up with, which is all a portfolio needs. To send from your own address (for example `hello@yourdomain.com`), verify the domain in Resend and add `CONTACT_FROM_EMAIL` = `Your Name <hello@yourdomain.com>`.

To test locally, put the same two lines in a file called `.env.local` in the project folder and restart `npm run dev`. Never commit that file; it's already in `.gitignore`.

**Hosting note:** the form needs a server, so it only works on Vercel (or Netlify). On GitHub Pages it stays hidden.

## Deploy

**GitHub Pages (current setup).** Every push to `main` runs `.github/workflows/deploy.yml`, which builds a static export and publishes it to https://pralinkarki.com.np. Static hosting has no server, so the contact form is hidden there; the email, WhatsApp and GitHub links still work. In the repo, **Settings → Pages → Source** must be set to **GitHub Actions**.

**Vercel (if you want the contact form).** Import the repo in Vercel and deploy; it builds normally with the API route. Set `NEXT_PUBLIC_SITE_URL=https://yourdomain.com` and the Resend variables above, then redeploy.

## Where to edit things

| Change | File | Look for |
|---|---|---|
| Name, intro, links, job details | `src/data/profile.ts` | SECTION 5 |
| Projects | `src/data/projects.ts` | SECTION 5 |
| Skills | `src/data/skills.ts` | SECTION 5 |
| Colors and fonts | `src/app/globals.css` | SECTION 1 |
| Camera position and parallax | `src/components/three/CameraController.tsx` | SECTION 1 |
| Intro timing (all of it) | `src/lib/intro.ts` | SECTION 4 |
| Text reveal speed | `src/app/globals.css` | SECTION 4 |
| Loading screen timing | `src/components/ui/LoadingScreen.tsx` | SECTION 4 |
| Lights (sun, sky, campfire, beacon) | `src/components/three/Lighting.tsx` | SECTION 2 |
| Sky colours, stars, haze, snow | `src/components/three/Environment.tsx` | SECTION 2 |
| Where each stop sits, the trail, the bridge, mountain shape | `src/lib/terrain.ts` | SECTION 3 |
| Camera views and angles | `src/lib/world.ts` | SECTION 1 |
| What stands at each stop, mountain colours, prayer flags, clouds | `src/components/three/world/Himalaya.tsx` | SECTION 2 |
| What each stop opens, tooltips | `src/data/hotspots.ts` | SECTION 3 |
| Which 3D scene a project card shows | `src/data/projects.ts` (`visual`: chart, rack, car, gold, printer, boxes, leaf, tee) | SECTION 5 |
| Skills, descriptions, where used | `src/data/skills.ts` | SECTION 5 |
| Skills orbits, colours, speeds | `src/components/three/skills/SkillsCanvas.tsx` | SECTION 4 |
| Contact form rules and error messages | `src/lib/contact.ts` | SECTION 5 |
| Contact email delivery | `src/app/api/contact/route.ts` | SECTION 5 |
| WhatsApp number | `src/data/profile.ts` (`whatsapp`) | SECTION 5 |
| Site address for share cards and sitemap | `src/lib/site.ts` or `NEXT_PUBLIC_SITE_URL` | SECTION 5 |
| Share card design | `src/lib/shareImage.tsx` | — |
| Camera pose at the end of the scroll | `src/lib/world.ts` (`scrollEnd`) | SECTION 1 |
| Ambient occlusion, bloom, vignette, reflections | `src/components/three/Effects.tsx` | SECTION 2 |
| Mobile vs desktop quality | `src/lib/device.ts` | SECTION 6 |

Fields set to `null` in the data files (job title, email, LinkedIn, resume, project links) are hidden on the site until you fill them in.

