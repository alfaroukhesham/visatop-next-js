export type WpMenuItemRaw = {
  id?: string | number;
  title?: string;
  label?: string;
  url?: string;
  children?: WpMenuItemRaw[];
};

export type WpLanguageOptionRaw = {
  slug?: string | null;
  name?: string | null;
  locale?: string | null;
  is_rtl?: boolean | null;
  current?: boolean | null;
};

export type WpHeadlessLayoutLanguage = {
  requested: string | null;
  current: string;
  available: WpLanguageOptionRaw[];
};

export type WpHeadlessLayoutResponse = {
  menus?: {
    header_menu?: WpMenuItemRaw[] | null;
    footer_menu?: WpMenuItemRaw[] | null;
  } | null;
  css?: Array<{ id?: string | number; url?: string | null }> | null;
  html?: {
    header?: string | null;
    footer?: string | null;
  } | null;
  language?: WpHeadlessLayoutLanguage | null;
};

export type NormalizedWpLink =
  | { kind: "internal"; href: string; label: string }
  | { kind: "external"; href: string; label: string };

export type NormalizedWpMenuItem = {
  id: string;
  label: string;
  link: NormalizedWpLink;
  children: NormalizedWpMenuItem[];
};

export type WpShellLanguageOption = {
  slug: string;
  name: string;
  isRtl: boolean;
  isCurrent: boolean;
};

export type WpShellModel = {
  headerMenu: NormalizedWpMenuItem[];
  footerMenu: NormalizedWpMenuItem[];
  cssUrls: string[];
  headerHtml: string | null;
  footerHtml: string | null;
  language: {
    current: string;
    available: WpShellLanguageOption[];
  } | null;
};

