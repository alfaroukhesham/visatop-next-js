"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FC } from "react";
import { Plus, Search } from "lucide-react";
import { CatalogEntityDeleteDialog } from "@/components/admin/catalog-entity-delete-dialog";
import { ListPaginatorBar } from "@/components/admin/list-paginator-bar";
import { usePaginatedList } from "@/components/admin/use-paginated-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CatalogService } from "@/lib/admin/catalog/catalog-types";

interface ICatalogServiceListProps {
  services: CatalogService[];
  canWrite: boolean;
}

export const CatalogServiceList: FC<ICatalogServiceListProps> = ({ services, canWrite }) => {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<CatalogService | null>(null);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const flash = (text: string, err = false) => {
    setBanner({ type: err ? "err" : "ok", text });
    setTimeout(() => setBanner(null), 4000);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return services;
    return services.filter((s) => s.name.toLowerCase().includes(q));
  }, [services, search]);

  const { setPage, ...page } = usePaginatedList(filtered);

  return (
    <Card className="border-border overflow-hidden border">
      <CardHeader className="border-border bg-muted/20 space-y-4 border-b">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="font-heading text-lg">Visa services</CardTitle>
            <CardDescription>
              Variants shown in the apply flow and public pricing resolution.
            </CardDescription>
          </div>
          {canWrite ? (
            <Link href="/admin/catalog/services/new" className={cn(buttonVariants(), "gap-2")}>
              <Plus className="size-4" />
              Add service
            </Link>
          ) : null}
        </div>
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="catalog-services-search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search by name…"
            className="pl-9"
            autoComplete="off"
            aria-label="Search services"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {banner ? (
          <p
            className={
              banner.type === "err"
                ? "border-destructive/40 bg-destructive/10 text-destructive border-b-2 px-4 py-3 text-sm"
                : "border-success/40 bg-success/10 text-success border-b-2 px-4 py-3 text-sm"
            }
            role="status"
          >
            {banner.text}
          </p>
        ) : null}
        <ul className="divide-border divide-y">
          {page.pageItems.length === 0 ? (
            <li className="text-muted-foreground px-4 py-6 text-center text-sm">
              {search.trim()
                ? "No services match your search."
                : "No visa services yet. Add a service to start."}
            </li>
          ) : null}
          {page.pageItems.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-4">
              <p className="min-w-0 font-medium">{s.name}</p>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={s.enabled ? "default" : "secondary"}>
                  {s.enabled ? "On" : "Off"}
                </Badge>
                <Link
                  href={`/admin/catalog/services/${encodeURIComponent(s.id)}/edit`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  {canWrite ? "Edit" : "View"}
                </Link>
                {canWrite ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setPendingDelete(s)}
                  >
                    Delete
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        <ListPaginatorBar
          selectId="catalog-services-page-size"
          page={page.page}
          setPage={setPage}
          pageSize={page.pageSize}
          onPageSizeChange={page.onPageSizeChange}
          total={page.total}
        />
      </CardContent>
      <CatalogEntityDeleteDialog
        entity={pendingDelete ? { kind: "service", id: pendingDelete.id, name: pendingDelete.name } : null}
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        onDeleted={() => {
          setPendingDelete(null);
          flash("Deleted service.");
          router.refresh();
        }}
        onBlocked={(msg) => flash(msg, true)}
      />
    </Card>
  );
};
