import {
  FALLBACK_CUSTOMER_LOCALE_SLUGS,
  type ICustomerLocaleOption,
} from "./customer-locale";
import { fetchWordpressRestJson } from "@/lib/wp-headless/wordpress-rest";

type TPolylangLanguageRaw = {
  slug?: string | null;
  name?: string | null;
  is_rtl?: boolean | null;
  locale?: string | null;
};

const FALLBACK_NAMES: Record<string, string> = {
  en: "English",
  fr: "Français",
  es: "Español",
  it: "Italiano",
  tr: "Türkçe",
  ar: "العربية",
  de: "Deutsch",
  hi: "हिन्दी",
  tl: "Tagalog",
  ru: "Русский",
  ha: "Hausa",
};

const fallbackOptions = (): ICustomerLocaleOption[] =>
  FALLBACK_CUSTOMER_LOCALE_SLUGS.map((slug) => ({
    slug,
    name: FALLBACK_NAMES[slug] ?? slug.toUpperCase(),
    isRtl: slug === "ar",
  }));

const normalizeLanguage = (raw: TPolylangLanguageRaw): ICustomerLocaleOption | null => {
  const slug = (raw.slug ?? "").trim().toLowerCase();
  if (!slug) return null;
  const name = (raw.name ?? slug).trim() || slug;
  return {
    slug,
    name,
    isRtl: raw.is_rtl === true || slug === "ar",
  };
};

export const fetchPolylangLanguages = async (input: {
  wpOrigin: string;
  revalidateSeconds?: number;
}): Promise<ICustomerLocaleOption[]> => {
  const wpOrigin = input.wpOrigin.trim();
  if (!wpOrigin) return fallbackOptions();

  const revalidateSeconds = input.revalidateSeconds ?? 300;
  const fetched = await fetchWordpressRestJson({
    wpOrigin,
    route: "/pll/v1/languages",
    revalidateSeconds,
  });
  if (!fetched) return fallbackOptions();

  try {
    const json = (await fetched.res.json()) as TPolylangLanguageRaw[] | null;
    if (!Array.isArray(json) || json.length === 0) return fallbackOptions();
    const options = json.map(normalizeLanguage).filter((o): o is ICustomerLocaleOption => o !== null);
    return options.length > 0 ? options : fallbackOptions();
  } catch {
    return fallbackOptions();
  }
};
