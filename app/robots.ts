import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/** Only the public marketing and legal pages are indexable. Everything behind sign-in is private. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/legal/", "/sign-up", "/sign-in"],
      disallow: [
        "/api/", "/admin", "/dashboard", "/profile", "/stories", "/streak", "/wishlist", "/connections",
        "/explore", "/avatar", "/match", "/room", "/feedback", "/onboarding", "/welcome", "/plans", "/auth/",
      ],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
