"use client";

import { useState, type FC } from "react";
import { AdminApplicationOpsPanel } from "@/components/admin/admin-application-ops-panel";
import { StatusBadge } from "@/components/admin/admin-application-detail-parts";
import type { TAdminTraveller } from "@/lib/admin/load-application-travellers";
import { cn } from "@/lib/utils";

export interface IAdminApplicationTravellersProps {
  travellers: TAdminTraveller[];
  initialSelectedId: string;
}

export const AdminApplicationTravellers: FC<IAdminApplicationTravellersProps> = ({
  travellers,
  initialSelectedId,
}) => {
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const selected =
    travellers.find((t) => t.applicationId === selectedId) ?? travellers[0];

  return (
    <div className="border border-border bg-card p-5 space-y-4">
      <h2 className="font-heading text-base font-semibold tracking-tight border-b-2 border-primary pb-0.5">
        Travellers on this application
      </h2>

      <div className="flex flex-wrap gap-2">
        {travellers.map((t) => {
          const active = t.applicationId === selected.applicationId;
          const label =
            t.travelerRole === "primary"
              ? "Primary traveller"
              : `Traveller ${t.travelerIndex + 1}`;
          return (
            <button
              key={t.applicationId}
              type="button"
              onClick={() => setSelectedId(t.applicationId)}
              className={cn(
                "px-3 py-2 text-sm border transition-colors",
                active
                  ? "border-primary bg-primary/10 text-primary font-semibold"
                  : "border-border text-muted-foreground hover:bg-muted/40",
              )}
            >
              <span className="block">{label}</span>
              <span className="block text-[11px] capitalize">{t.travelerKind}</span>
              <span className="block text-[11px] text-muted-foreground">{t.serviceName}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-6">
        <StatusBadge label="Application" value={selected.applicationStatus} />
        <StatusBadge label="Payment" value={selected.paymentStatus} />
        <StatusBadge label="Fulfillment" value={selected.fulfillmentStatus} />
      </div>

      <div className="border-t border-border pt-4">
        <h3 className="font-heading text-sm font-semibold tracking-tight mb-2">
          Fulfillment &amp; outcomes
        </h3>
        <AdminApplicationOpsPanel
          key={selected.applicationId}
          applicationId={selected.applicationId}
          paymentStatus={selected.paymentStatus}
          applicationStatus={selected.applicationStatus}
          documents={selected.documents.map((d) => ({
            id: d.id,
            documentType: d.documentType,
            status: d.status,
            createdAt:
              d.createdAt instanceof Date ? d.createdAt.toISOString() : String(d.createdAt),
            originalFilename: d.originalFilename,
            byteLength: d.byteLength,
          }))}
        />
      </div>
    </div>
  );
};
