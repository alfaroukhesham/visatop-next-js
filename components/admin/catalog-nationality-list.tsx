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
import type { CatalogNationality } from "@/lib/admin/catalog/catalog-types";

interface ICatalogNationalityListProps {
  nationalities: CatalogNationality[];
  canWrite: boolean;
}

export const CatalogNationalityList: FC<ICatalogNationalityListProps> = ({
  nationalities,
  canWrite,
}) => {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<CatalogNationality | null>(null);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const flash = (text: string, err = false) => {
    setBanner({ type: err ? "err" : "ok", text });
    setTimeout(() => setBanner(null), 4000);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return nationalities;
    return nationalities.filter((n) => n.name.toLowerCase().includes(q) || n.code.toLowerCase().includes(q));
  }, [nationalities, search]);

  const { setPage, ...page } = usePaginatedList(filtered);

  return (
    <Card className="border-border overflow-hidden border">
      <CardHeader className="border-border bg-muted/20 space-y-4 border-b">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="font-heading text-lg">Nationalities</CardTitle>
            <CardDescription>
              ISO alpha-2 codes. Public catalog only lists enabled rows with at least one eligible service.
            </CardDescription>
          </div>
          {canWrite ? (
            <Link href="/admin/catalog/nationalities/new" className={cn(buttonVariants(), "gap-2")}>
              <Plus className="size-4" />
              Add nationality
            </Link>
          ) : null}
        </div>
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="catalog-nationalities-search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search by name or code…"
            className="pl-9"
            autoComplete="off"
            aria-label="Search nationalities"
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
                ? "No nationalities match your search."
                : "No nationalities yet. Add a nationality to start."}
            </li>
          ) : null}
          {page.pageItems.map((n) => (
            <li key={n.code} className="flex items-center justify-between gap-3 px-4 py-4">
              <p className="min-w-0 font-medium">{n.name}</p>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={n.enabled ? "default" : "secondary"}>
                  {n.enabled ? "On" : "Off"}
                </Badge>
                <Link
                  href={`/admin/catalog/nationalities/${encodeURIComponent(n.code)}`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  Open
                </Link>
                {canWrite ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setPendingDelete(n)}
                  >
                    Delete
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        <ListPaginatorBar
          selectId="catalog-nationalities-page-size"
          page={page.page}
          setPage={setPage}
          pageSize={page.pageSize}
          onPageSizeChange={page.onPageSizeChange}
          total={page.total}
        />
      </CardContent>
      <CatalogEntityDeleteDialog
        entity={pendingDelete ? { kind: "nationality", code: pendingDelete.code, name: pendingDelete.name } : null}
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        onDeleted={() => {
          setPendingDelete(null);
          flash("Deleted nationality.");
          router.refresh();
        }}
        onBlocked={(msg) => flash(msg, true)}
      />
    </Card>
  );
};
