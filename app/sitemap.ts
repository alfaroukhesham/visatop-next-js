import type { MetadataRoute } from "next";
import { appHref } from "@/lib/app-href";

/** Indexable client routes only (auth/utility URLs are noindex and omitted). */
const PUBLIC_SITEMAP_ROUTES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
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
