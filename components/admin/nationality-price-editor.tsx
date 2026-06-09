"use client";

import Link from "next/link";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NationalityPriceEditorCard } from "@/components/admin/nationality-price-editor-card";
import {
  useNationalityPriceEditor,
  type NationalityOption,
} from "@/components/admin/use-nationality-price-editor";

export type { NationalityOption };

export function NationalityPriceEditor({
  nationalities,
  canWrite,
}: {
  nationalities: NationalityOption[];
  canWrite: boolean;
}) {
  const editor = useNationalityPriceEditor(nationalities);

  return (
    <Card className="rounded-none border-border">
      <CardHeader>
        <CardTitle>Update prices for a nationality</CardTitle>
        <CardDescription>
          Choose a nationality to see services that already have a customer price for that nationality. Only rows with
          a new price are saved; the other currency is derived via FX. To add a new service, use{" "}
          <Link href="/admin/catalog" className="text-primary underline underline-offset-2">
            Catalog → Services
          </Link>
          . If you see duplicate names from repeated imports, run catalog cleanup below.
        </CardDescription>
      </CardHeader>
      <NationalityPriceEditorCard nationalities={nationalities} canWrite={canWrite} editor={editor} />
    </Card>
  );
}
