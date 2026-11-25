import type { FC } from "react";
import { useCustomerT } from "@/components/client/customer-i18n-provider";

interface IProcessingSpeedLineProps {
  speed: "standard" | "fast_track" | null | undefined;
  /** Admin Fast Track promise, when set. Otherwise the 24-hour default. */
  fastTrackPromise?: string | null;
  className?: string;
}

export const ProcessingSpeedLine: FC<IProcessingSpeedLineProps> = ({
  speed,
  fastTrackPromise,
  className,
}) => {
  const t = useCustomerT();
  if (speed !== "standard" && speed !== "fast_track") return null;
  const promise = fastTrackPromise?.trim() ?? "";
  const text =
    speed === "fast_track"
      ? promise
        ? t("speed.readonly.fastCustom", { promise })
        : t("speed.readonly.fast")
      : t("speed.readonly.standard");
  const splitAt = text.indexOf(":");
  const label = splitAt >= 0 ? text.slice(0, splitAt + 1) : text;
  const value = splitAt >= 0 ? text.slice(splitAt + 1).trim() : "";
  return (
    <p className={className ?? "text-sm"} data-testid="processing-speed-line">
      <span className="text-muted-foreground">{label}</span>
      {value ? <span className="text-foreground"> {value}</span> : null}
    </p>
  );
};
