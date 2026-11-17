import { profile } from "@/data/profile";
import { SHARE_SIZE, shareImage } from "@/lib/shareImage";

export const alt = `${profile.name}, ${profile.title.toLowerCase()} from ${profile.place.city}, ${profile.place.country}`;
export const dynamic = "force-static";
export const size = SHARE_SIZE;
export const contentType = "image/png";

export default function Image() {
  return shareImage({ eyebrow: "Developer portfolio", title: profile.name, subtitle: profile.tagline });
}
