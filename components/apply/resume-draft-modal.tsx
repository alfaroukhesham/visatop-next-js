"use client";

import { useEffect, useState, type FC } from "react";
import { DoubleDecision } from "@/components/client/double-decision";
import {
  ClientDialog,
  ClientDialogContent,
  ClientDialogDescription,
  ClientDialogFooter,
  ClientDialogHeader,
  ClientDialogTitle,
} from "@/components/client/client-dialog";
import { apiHref } from "@/lib/app-href";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import type { TResumeHint } from "@/lib/applications/resume-hint";

export const RESUME_DRAFT_MODAL_CTA = "Continue";

const RESUME_PROMPT_DISMISSED_KEY = "vt_resume_prompt_dismissed";

const readResumePromptDismissed = (): boolean => {
  try {
    return sessionStorage.getItem(RESUME_PROMPT_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
};

const writeResumePromptDismissed = (): void => {
  try {
    sessionStorage.setItem(RESUME_PROMPT_DISMISSED_KEY, "1");
  } catch {
    /* private mode / blocked storage */
  }
};

interface IResumeDraftModalProps {
  resumeBannerCta?: string;
}

export const ResumeDraftModal: FC<IResumeDraftModalProps> = ({ resumeBannerCta = RESUME_DRAFT_MODAL_CTA }) => {
  const [hint, setHint] = useState<TResumeHint | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (readResumePromptDismissed()) return;

    let cancelled = false;

    const loadHint = async () => {
      const res = await fetchApiEnvelope<{ hint: TResumeHint | null }>(
        apiHref("/applications/resume-hint"),
      );
      if (cancelled || !res.ok || !res.data.hint) return;
      if (readResumePromptDismissed()) return;
      setHint(res.data.hint);
      setOpen(true);
    };

    void loadHint();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismissPrompt = () => {
    writeResumePromptDismissed();
    setOpen(false);
  };

  if (!hint) return null;

  const travelerLabel =
    hint.travelerCount === 1 ? "1 traveler" : `${hint.travelerCount} travelers`;

  return (
    <ClientDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          writeResumePromptDismissed();
        }
        setOpen(next);
      }}
    >
      <ClientDialogContent showCloseButton>
        <ClientDialogHeader>
          <ClientDialogTitle>Resume from where you started</ClientDialogTitle>
          <ClientDialogDescription>
            Continue your application — {hint.nationalityName} · {hint.serviceName}
          </ClientDialogDescription>
        </ClientDialogHeader>
        <p className="text-secondary text-sm font-medium">{travelerLabel}</p>
        <ClientDialogFooter>
          <DoubleDecision
            dismissLabel="Not now"
            confirmLabel={resumeBannerCta}
            confirmHref={hint.href}
            onDismiss={dismissPrompt}
          />
        </ClientDialogFooter>
      </ClientDialogContent>
    </ClientDialog>
  );
};
