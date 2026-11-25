import { notFound } from "next/navigation";
import type { FC } from "react";
import { ExtrasStepPreviewClient } from "./extras-step-preview-client";

export const dynamic = "force-dynamic";

interface IExtrasStepPreviewPageProps {
  searchParams?: Promise<{ view?: string; insurance?: string }>;
}

const allowFixture = (): boolean =>
  process.env.NODE_ENV !== "production" || process.env.ALLOW_UX_READY_FIXTURE === "1";

const ExtrasStepPreviewPage: FC<IExtrasStepPreviewPageProps> = async ({ searchParams }) => {
  if (!allowFixture()) notFound();
  const query = (await searchParams) ?? {};
  const view = query.view === "pay" ? "pay" : "extras";
  const selected = query.insurance === "1";
  return (
    <div className="max-w-6xl">
      <ExtrasStepPreviewClient view={view} selected={selected} />
    </div>
  );
};

export default ExtrasStepPreviewPage;
