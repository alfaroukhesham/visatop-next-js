import type { MetadataRoute } from "next";
import { appHref } from "@/lib/app-href";

/** Public, indexable client routes (excludes auth-gated portal and per-application pages). */
const PUBLIC_SITEMAP_ROUTES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/sign-in", changeFrequency: "monthly", priority: 0.6 },
  { path: "/sign-up", changeFrequency: "monthly", priority: 0.6 },
  { path: "/apply/track", changeFrequency: "weekly", priority: 0.8 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return PUBLIC_SITEMAP_ROUTES.map(({ path, changeFrequency, priority }) => ({
    url: appHref(path),
    lastModified,
    changeFrequency,
    priority,
  }));
}
