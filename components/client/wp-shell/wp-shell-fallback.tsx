import type { FC } from "react";
import Link from "next/link";
import type { TCustomerMessageVars } from "@/lib/i18n/customer-messages";

type TCustomerT = (key: string, vars?: TCustomerMessageVars) => string;

interface IWpShellFallbackHeaderProps {
  t: TCustomerT;
}

export const WpShellFallbackHeader: FC<IWpShellFallbackHeaderProps> = ({ t }) => {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex w-full max-w-[calc(1300px+3rem)] items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link href="/" className="font-semibold tracking-tight">
          Visatop
        </Link>
        <nav aria-label={t("common.primaryNavAriaLabel")}>
          <ul className="flex items-center gap-5">
            <li>
              <Link href="/" className="hover:underline">
                {t("common.apply")}
              </Link>
            </li>
            <li>
              <Link href="/portal/track" className="hover:underline">
                {t("common.portal")}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
};

interface IWpShellFallbackFooterProps {
  t: TCustomerT;
}

export const WpShellFallbackFooter: FC<IWpShellFallbackFooterProps> = ({ t }) => {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t bg-white py-10 text-center text-sm text-muted-foreground">
      <div className="mx-auto w-full max-w-[calc(1300px+3rem)] px-5 sm:px-8">
        {t("common.copyright", { year })}
      </div>
    </footer>
  );
};
