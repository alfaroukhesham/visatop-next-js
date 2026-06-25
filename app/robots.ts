import type { MetadataRoute } from "next";
import { appHref } from "@/lib/app-href";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/"],
    },
    sitemap: appHref("/sitemap.xml"),
  };
}
