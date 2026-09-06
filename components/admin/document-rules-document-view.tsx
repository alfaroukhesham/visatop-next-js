"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FC } from "react";
import { DocumentRulesAssignmentCountries } from "@/components/admin/document-rules-assignment-countries";
import { DocumentRulesDeleteDialog } from "@/components/admin/document-rules-delete-dialog";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { TCatalogDocumentType } from "@/lib/admin/catalog/document-type";
import { cn } from "@/lib/utils";

interface IDocumentRulesDocumentViewProps {
  document: TCatalogDocumentType;
  canWrite: boolean;
}

export const DocumentRulesDocumentView: FC<IDocumentRulesDocumentViewProps> = ({
  document,
  canWrite,
}) => {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const assignHref = `/admin/document-rules/${encodeURIComponent(document.key)}/assign`;

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        <Link href="/admin/document-rules" className="underline underline-offset-4">
          All documents
        </Link>
      </p>

      <p className="text-muted-foreground text-sm">
        Every application always needs passport + personal photo. Those cannot be turned off.
      </p>

      <Card className="border-border overflow-hidden border">
        <CardHeader className="border-border bg-muted/20 space-y-4 border-b">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="font-heading text-lg">Assignments</CardTitle>
              <CardDescription>
                {document.description ||
                  "Countries that need this document. Open a country to edit its services, or add another country."}
              </CardDescription>
            </div>
            {canWrite ? (
              <div className="flex flex-wrap gap-2">
                <Link href={assignHref} className={cn(buttonVariants({ variant: "outline" }))}>
                  Bulk assign
                </Link>
                <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
                  Delete document
                </Button>
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <DocumentRulesAssignmentCountries documentType={document.key} canWrite={canWrite} />
        </CardContent>
      </Card>

      <DocumentRulesDeleteDialog
        document={document}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => router.push("/admin/document-rules")}
      />
    </div>
  );
};
