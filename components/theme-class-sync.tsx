"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Keeps client routes light-only: strips persisted `html.dark` when navigating
 * from admin. Admin routes leave theme class management to next-themes.
 */
export function ThemeClassSync() {
  const pathname = usePathname();

  useEffect(() => {
    const isAdmin = pathname.startsWith("/admin");
    if (isAdmin) return;

    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "light";
  }, [pathname]);

  return null;
}
