import { notFound } from "next/navigation";
import type { FC } from "react";
import { ApplyTwoColumn } from "@/components/apply/apply-two-column";
import { UxReadyRouteMirrorClient } from "./ux-ready-route-mirror-client";

export const dynamic = "force-dynamic";

const allowFixture = (): boolean =>
  process.env.NODE_ENV !== "production" || process.env.ALLOW_UX_READY_FIXTURE === "1";

const UxReadyRouteMirrorPage: FC = () => {
  if (!allowFixture()) notFound();
  return (
    <div className="max-w-6xl">
      <ApplyTwoColumn
        currentStep={3}
        phase="documents"
        applicationId="ux-ready-fixture"
        tripHref="/apply/start?nationality=IN"
        hasSelectedVisa
        contentFirstOnMobile
        visaSummary={
          <aside className="border-border bg-card space-y-3 rounded-2xl border p-4">
            <p className="text-foreground text-sm font-semibold">Your order</p>
            {Array.from({ length: 14 }, (_, index) => (
              <p key={index} className="text-muted-foreground text-sm">
                Order line {index + 1}
              </p>
            ))}
          </aside>
        }
        contentClassName="theme-client-rise mx-auto w-full max-w-4xl space-y-8"
      >
        <UxReadyRouteMirrorClient />
      </ApplyTwoColumn>
    </div>
  );
};

export default UxReadyRouteMirrorPage;
