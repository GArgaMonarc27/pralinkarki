import type { NextConfig } from "next";

// Two ways to deploy:
// - GitHub Pages (what .github/workflows/deploy.yml does): STATIC_EXPORT=1
//   builds plain files into out/. The /api/contact route is removed before
//   that build, so the contact form stays hidden there.
// - A host that runs Next.js (Vercel, Netlify): build normally and the
//   contact form works once its environment variables are set.
const staticExport = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // three.js ships ES modules that Next can bundle directly.
  transpilePackages: ["three"],
  ...(staticExport && {
    output: "export",
    trailingSlash: true,
    images: { unoptimized: true },
  }),
};

export default nextConfig;
