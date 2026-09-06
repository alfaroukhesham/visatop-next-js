"use client";

import { useState, type FC } from "react";
import { CatalogDocumentRulesAssignForm } from "@/components/admin/catalog-document-rules-assign-form";
import { CatalogDocumentRulesTable } from "@/components/admin/catalog-document-rules-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ICatalogDocumentRulesSectionProps {
  canWrite: boolean;
  busy: boolean;
  flash: (text: string, err?: boolean) => void;
  onAddEligibility: (nationalityCode: string) => void;
  pickerRefreshKey: number;
}

export const CatalogDocumentRulesSection: FC<ICatalogDocumentRulesSectionProps> = ({
  canWrite,
  busy,
  flash,
  onAddEligibility,
  pickerRefreshKey,
}) => {
  const [tableRefreshKey, setTableRefreshKey] = useState(0);
  const onChanged = () => setTableRefreshKey((n) => n + 1);

  return (
    <Card className="border-border overflow-hidden border">
      <CardHeader className="border-border bg-muted/20 border-b">
        <CardTitle className="font-heading text-lg">Document rules</CardTitle>
        <CardDescription>
          Assign extra documents to a country’s eligible products. Use Add eligibility if a product is missing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <CatalogDocumentRulesAssignForm
          canWrite={canWrite}
          busy={busy}
          flash={flash}
          onChanged={onChanged}
          onAddEligibility={onAddEligibility}
          pickerRefreshKey={pickerRefreshKey}
        />
        <CatalogDocumentRulesTable
          canWrite={canWrite}
          busy={busy}
          flash={flash}
          onChanged={onChanged}
          refreshKey={tableRefreshKey}
        />
      </CardContent>
    </Card>
  );
};
