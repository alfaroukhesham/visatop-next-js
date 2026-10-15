"use client";

import { type FC, useEffect, useRef } from "react";
import { apiHref } from "@/lib/app-href";

interface IResumeRedeemFormProps {
  token: string;
  ctaLabel: string;
}

export const ResumeRedeemForm: FC<IResumeRedeemFormProps> = ({ token, ctaLabel }) => {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.requestSubmit();
  }, []);

  return (
    <form
      ref={formRef}
      method="POST"
      action={apiHref("apply/resume")}
      className="flex flex-col items-center gap-3"
    >
      <input type="hidden" name="t" value={token} />
      <button
        type="submit"
        className="bg-foreground text-background rounded-md px-5 py-2.5 text-sm font-semibold"
      >
        {ctaLabel}
      </button>
    </form>
  );
};
