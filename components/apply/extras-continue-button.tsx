import { ChevronRight } from "lucide-react";
import type { FC } from "react";
import { ClientButton } from "@/components/client/client-button";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import { cn } from "@/lib/utils";

interface IExtrasContinueButtonProps {
  onClick: () => void;
  disabled?: boolean;
  /** Sticky bar: natural width, allowed to shrink. Desktop: at least 240px. */
  compact?: boolean;
  className?: string;
}

/** Gold forward button on Extras. The skip link sits beside it. */
export const ExtrasContinueButton: FC<IExtrasContinueButtonProps> = ({
  onClick,
  disabled,
  compact = false,
  className,
}) => {
  const t = useCustomerT();
  return (
    <ClientButton
      type="button"
      brand="cta"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-1",
        compact
          ? "h-11 min-h-11 w-auto min-w-0 shrink-0 whitespace-nowrap px-3 text-sm leading-none tracking-normal"
          : "min-w-[240px] self-start",
        className,
      )}
    >
      {compact ? t("extras.ctaShort") : t("extras.cta")}
      <ChevronRight className="size-4 shrink-0 rtl:-scale-x-100" aria-hidden />
    </ClientButton>
  );
};
