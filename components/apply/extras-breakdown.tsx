import { Loader2 } from "lucide-react";
import type { FC, ReactNode } from "react";
import { useCustomerLocale, useCustomerT } from "@/components/client/customer-i18n-provider";
import { customerFacingServiceName } from "@/lib/apply/customer-service-name";
import {
  extraByKey,
  formatMinorAmount,
  groupedExtraLines,
  type TClientQuotePreview,
} from "@/lib/apply/checkout-extras-ui";
import { ProcessingSpeedLine } from "@/components/apply/processing-speed-line";

interface IExtrasBreakdownProps {
  preview: TClientQuotePreview;
  visaNames: readonly string[];
  updating: boolean;
  /** Desktop aside includes the read-only speed line. The mobile card does not. */
  showSpeed?: boolean;
  /** Pay shows insurance only when it was added. Extras always reserves the row. */
  insuranceMode?: "always" | "when-added";
  /** Extras keeps an empty updating row so the total does not jump. Pay shows it only while saving. */
  updatingMode?: "reserved" | "when-updating";
  /** Pay puts "Change extras" on the insurance row. */
  insuranceAction?: ReactNode;
  announcement?: string | null;
  /** Only the Extras step panel announces the total. Cards pass false. */
  live?: boolean;
}

const uniqueNames = (names: readonly string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
};

export const ExtrasBreakdown: FC<IExtrasBreakdownProps> = ({
  preview,
  visaNames,
  updating,
  showSpeed = false,
  insuranceMode = "always",
  updatingMode = "reserved",
  insuranceAction = null,
  announcement = null,
  live = true,
}) => {
  const t = useCustomerT();
  const locale = useCustomerLocale();
  const money = (minor: string) => formatMinorAmount(minor, preview.currency, locale, "code");
  const count = Math.max(preview.travellerCount, preview.visaLines.length, 1);
  const groups = groupedExtraLines(preview);
  const fastTrack = groups.find((row) => row.key === "fast_track") ?? null;
  const insurance = groups.find((row) => row.key === "travel_insurance") ?? null;
  const showInsurance = insuranceMode === "always" || Boolean(insurance);
  const names = uniqueNames(visaNames);
  const fastTrackExtra = extraByKey(preview, "fast_track");
  const fastPromise =
    fastTrackExtra?.promiseI18n?.[locale]?.trim() ||
    fastTrackExtra?.promiseI18n?.en?.trim() ||
    null;

  return (
    <div
      className="relative space-y-3"
      aria-busy={updating || undefined}
      data-testid="extras-breakdown"
    >
      <div className="flex min-h-6 items-baseline justify-between gap-3 text-sm">
        <p className="text-foreground min-w-0 break-words text-pretty">
          {t("extras.recap.visa")}
          {names.map((name) => {
            const label = customerFacingServiceName(name, locale, t);
            return (
              <span key={name}>
                {" · "}
                <bdi className="break-words" title={label}>
                  {label}
                </bdi>
              </span>
            );
          })}
          <span className="text-muted-foreground whitespace-nowrap"> × {count}</span>
        </p>
        <p className="text-foreground shrink-0 text-end font-normal tabular-nums">
          <bdi>{money(preview.visaAmountMinor)}</bdi>
        </p>
      </div>
      {preview.processingSpeed === "fast_track" && fastTrack ? (
        <div className="flex min-h-6 items-baseline justify-between gap-3 text-sm">
          <p className="text-foreground min-w-0">
            {t("extras.recap.fastTrack")}
            <span className="text-muted-foreground"> × {fastTrack.count}</span>
          </p>
          <p className="text-foreground shrink-0 text-end font-normal tabular-nums">
            <bdi>{money(fastTrack.amountMinor)}</bdi>
          </p>
        </div>
      ) : null}
      {showInsurance ? (
        <div className="flex min-h-6 items-baseline justify-between gap-3 text-sm">
          <p className="text-foreground min-w-0">
            {t("extras.recap.insurance")}
            <span className="text-muted-foreground"> × {insurance?.count ?? count}</span>
          </p>
          <div className="flex shrink-0 items-baseline justify-end gap-3">
            {insurance ? (
              <p className="text-foreground text-end font-normal tabular-nums">
                <bdi>{money(insurance.amountMinor)}</bdi>
              </p>
            ) : (
              <p className="text-muted-foreground text-end">{t("extras.recap.notAdded")}</p>
            )}
            {insuranceAction}
          </div>
        </div>
      ) : null}
      <div className="border-border flex min-h-6 items-baseline justify-between gap-3 border-t pt-3 text-sm">
        <p className="text-foreground font-semibold">{t("extras.recap.total")}</p>
        <p className="text-foreground font-heading shrink-0 text-end text-base font-bold tabular-nums">
          <bdi>{money(preview.totalAmountMinor)}</bdi>
        </p>
      </div>
      {updatingMode === "reserved" || updating ? (
        <p className="text-muted-foreground flex min-h-6 items-center gap-2 text-sm">
          {updating ? (
            <>
              <Loader2 className="size-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />
              <span>{t("extras.recap.updating")}</span>
            </>
          ) : null}
        </p>
      ) : null}
      {showSpeed ? (
        <ProcessingSpeedLine
          speed={preview.processingSpeed}
          fastTrackPromise={fastPromise}
        />
      ) : null}
      {live ? (
        <p
          className="absolute size-px overflow-hidden whitespace-nowrap border-0 p-0 [clip:rect(0,0,0,0)]"
          role="status"
          aria-live="polite"
        >
          {announcement ?? ""}
        </p>
      ) : null}
    </div>
  );
};
