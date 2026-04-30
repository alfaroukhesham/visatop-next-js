export type WpMenuItemRaw = {
  id?: string | number;
  title?: string;
  label?: string;
  url?: string;
  children?: WpMenuItemRaw[];
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

export type WpShellModel = {
  headerMenu: NormalizedWpMenuItem[];
  footerMenu: NormalizedWpMenuItem[];
  cssUrls: string[];
  headerHtml: string | null;
  footerHtml: string | null;
};

