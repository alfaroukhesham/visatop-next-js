"use client";

import type { FC } from "react";
import { ShieldCheck } from "lucide-react";
import {
  APPLY_STICKY_CTA_MEDIA_QUERY,
  ApplyReadyContinue,
  ApplyReadyPreviousButton,
} from "@/components/apply/apply-ready-continue";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import { ReadyDocumentAccordion } from "@/components/apply/draft/ready-document-accordion";
import { PHOTO_SLOT } from "@/lib/apply/document-slot-catalog";
import { useNarrowViewport } from "@/lib/client/use-narrow-viewport";

export const UxReadyRouteMirrorClient: FC = () => {
  const t = useCustomerT();
  const compactCta = useNarrowViewport(APPLY_STICKY_CTA_MEDIA_QUERY);
  return (
    <section className="space-y-5" data-apply-ready-section="">
      <h1 className="font-heading text-foreground text-xl font-semibold tracking-tight md:text-[1.75rem]">
        {t("wizard.readyTitle")}
      </h1>
      <p className="text-foreground text-sm leading-relaxed">{t("wizard.readyInstruction")}</p>
      <ReadyDocumentAccordion
        neededNow={[
          {
            key: "passport_copy",
            label: t("wizard.passportNow"),
            description: t("documents.slots.passportCopy.description"),
            icon: "passport",
          },
        ]}
        addLater={[
          {
            key: PHOTO_SLOT.key,
            label: t("documents.slots.personalPhoto.label"),
            description: PHOTO_SLOT.description,
            icon: "photo",
            tip: t("wizard.takesTwoMinutes"),
          },
        ]}
      />
      <p className="text-muted-foreground text-sm">{t("wizard.takesTwoMinutes")}</p>
      <p className="text-muted-foreground flex items-center gap-2 text-xs">
        <ShieldCheck className="size-4 shrink-0" aria-hidden />
        {t("wizard.encrypted")}
      </p>
      <ApplyReadyPreviousButton inline hidden={compactCta} onClick={() => undefined}>
        {t("common.previous")}
      </ApplyReadyPreviousButton>
      <ApplyReadyContinue previousLabel={t("common.previous")} onPrevious={() => undefined} onClick={() => undefined}>
        {t("wizard.continueWithDocuments")}
      </ApplyReadyContinue>
    </section>
  );
};
