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

/**
 * The only forward button on Extras.
 * Isolated so a later Skip button can replace this one component.
 */
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
          ? "h-auto min-h-11 min-w-0 flex-1 whitespace-normal px-2 py-1.5 text-xs leading-tight tracking-normal"
          : "min-w-[240px] self-start",
        className,
      )}
    >
      {t("extras.cta")}
      <ChevronRight className="size-4 shrink-0 rtl:-scale-x-100" aria-hidden />
    </ClientButton>
  );
};
