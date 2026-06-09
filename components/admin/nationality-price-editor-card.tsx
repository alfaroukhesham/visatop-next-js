"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { NationalityPriceEditorTable } from "@/components/admin/nationality-price-editor-table";
import type { useNationalityPriceEditor } from "@/components/admin/use-nationality-price-editor";
import type { NationalityOption } from "@/components/admin/use-nationality-price-editor";

type EditorApi = ReturnType<typeof useNationalityPriceEditor>;

export function NationalityPriceEditorCard({
  nationalities,
  canWrite,
  editor,
}: {
  nationalities: NationalityOption[];
  canWrite: boolean;
  editor: EditorApi;
}) {
  const { state, dispatch, selectedNat, handleNationalityChange, savePrices, cleanupOrphans } = editor;

  return (
    <>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="nat-price-nationality">Nationality</Label>
            <select
              id="nat-price-nationality"
              value={state.nationalityCode}
              onChange={(e) => handleNationalityChange(e.target.value)}
              className="border-border bg-background h-9 w-full rounded-none border px-2 text-sm"
            >
              <option value="">Select nationality…</option>
              {nationalities.map((n) => (
                <option key={n.code} value={n.code} disabled={!n.enabled}>
                  {n.name} ({n.code}){!n.enabled ? " — disabled" : ""}
                </option>
              ))}
            </select>
          </div>
          {state.nationalityCode ? (
            <div className="space-y-2">
              <Label htmlFor="nat-price-currency">New prices in</Label>
              <select
                id="nat-price-currency"
                value={state.currency}
                onChange={(e) =>
                  dispatch({ type: "SET_CURRENCY", currency: e.target.value as "USD" | "AED" })
                }
                className="border-border bg-background h-9 w-full rounded-none border px-2 text-sm"
              >
                <option value="USD">USD</option>
                <option value="AED">AED</option>
              </select>
            </div>
          ) : null}
        </div>

        {canWrite ? (
          <div className="flex flex-wrap items-center gap-2 border border-border bg-muted/20 p-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-none"
              disabled={state.cleaning || state.saving}
              onClick={() => void cleanupOrphans()}
            >
              {state.cleaning ? <Loader2 className="size-4 animate-spin" /> : null}
              Clean up orphan catalog data
            </Button>
            <p className="text-muted-foreground text-xs">
              Removes duplicate empty services from old imports and eligibility rows without prices.
            </p>
          </div>
        ) : null}

        {state.error ? (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}
        {state.success ? (
          <Alert>
            <AlertDescription>{state.success}</AlertDescription>
          </Alert>
        ) : null}

        {state.nationalityCode ? (
          state.rows.length === 0 && !state.loading ? (
            <p className="text-muted-foreground text-sm">
              No customer prices for this nationality yet. Import a price sheet or add prices in{" "}
              <Link href="/admin/catalog" className="text-primary underline underline-offset-2">
                Catalog
              </Link>
              . If duplicates appear after imports, use catalog cleanup above.
            </p>
          ) : (
            <NationalityPriceEditorTable
              rows={state.rows}
              drafts={state.drafts}
              currency={state.currency}
              loading={state.loading}
              canWrite={canWrite}
              saving={state.saving}
              onDraftChange={(serviceId, value) =>
                dispatch({ type: "SET_DRAFT", serviceId, value })
              }
            />
          )
        ) : null}
      </CardContent>
      {state.nationalityCode && state.rows.length > 0 ? (
        <CardFooter className="border-t border-border bg-muted/30">
          <Button
            type="button"
            className="rounded-none"
            disabled={!canWrite || state.saving || state.loading}
            onClick={() => void savePrices()}
          >
            {state.saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save price changes
          </Button>
          {!canWrite ? (
            <p className="text-muted-foreground ml-4 text-xs">
              Requires catalog.write and audit.write permissions.
            </p>
          ) : null}
          {selectedNat ? (
            <p className="text-muted-foreground ml-auto text-xs hidden sm:block">
              Editing: {selectedNat.name} ({selectedNat.code})
            </p>
          ) : null}
        </CardFooter>
      ) : null}
    </>
  );
}
