type TWpRestFetchInput = {
  wpOrigin: string;
  route: string;
  searchParams?: Record<string, string>;
};

const normalizeRoute = (route: string): string =>
  route.startsWith("/") ? route : `/${route}`;

/** Pretty permalinks first; `rest_route` when `/wp-json/` is not rewritten to PHP. */
export const buildWordpressRestCandidateUrls = (input: TWpRestFetchInput): string[] => {
  const origin = input.wpOrigin.replace(/\/+$/, "");
  const route = normalizeRoute(input.route);
  const pretty = new URL(`/wp-json${route}`, `${origin}/`);
  const restRoute = new URL(`${origin}/`);
  restRoute.searchParams.set("rest_route", route);
  for (const [key, value] of Object.entries(input.searchParams ?? {})) {
    if (!value) continue;
    pretty.searchParams.set(key, value);
    restRoute.searchParams.set(key, value);
  }
  return [pretty.toString(), restRoute.toString()];
};

export const fetchWordpressRestJson = async (input: TWpRestFetchInput & {
  revalidateSeconds?: number;
}): Promise<{ res: Response; url: string; form: "pretty" | "rest_route" } | null> => {
  const urls = buildWordpressRestCandidateUrls(input);
  const revalidateSeconds = input.revalidateSeconds ?? 60;
  const headers = { accept: "application/json" };

  for (let i = 0; i < urls.length; i += 1) {
    const url = urls[i]!;
    const form = i === 0 ? "pretty" : "rest_route";
    try {
      const res = await fetch(url, {
        next: { revalidate: revalidateSeconds },
        headers,
      });
      if (res.ok) return { res, url, form };
    } catch {
      continue;
    }
  }
  return null;
};
