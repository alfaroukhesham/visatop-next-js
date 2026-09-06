"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FC } from "react";
import { Loader2, Search } from "lucide-react";
import { ListPaginatorBar } from "@/components/admin/list-paginator-bar";
import { usePaginatedList } from "@/components/admin/use-paginated-list";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { linkCatalogEligibilityPairs } from "@/lib/admin/catalog/eligibility-mutations";
import type { CatalogNationality, CatalogService } from "@/lib/admin/catalog/catalog-types";

interface ICatalogEligibilityPickerProps {
  mode: "nationality" | "service";
  nationalityCode?: string;
  serviceId?: string;
  parentHref: string;
  canWrite: boolean;
  candidates: CatalogNationality[] | CatalogService[];
}

export const CatalogEligibilityPicker: FC<ICatalogEligibilityPickerProps> = ({
  mode,
  nationalityCode,
  serviceId,
  parentHref,
  canWrite,
  candidates,
}) => {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) => {
      if (mode === "nationality") {
        const s = c as CatalogService;
        return s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
      }
      const n = c as CatalogNationality;
      return n.code.toLowerCase().includes(q) || n.name.toLowerCase().includes(q);
    });
  }, [candidates, search, mode]);

  const { setPage, ...page } = usePaginatedList(filtered);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const addSelected = async () => {
    if (!canWrite || selected.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const pairs = [...selected].map((key) => {
        if (mode === "nationality") {
          return { serviceId: key, nationalityCode: nationalityCode! };
        }
        return { serviceId: serviceId!, nationalityCode: key };
      });
      const res = await linkCatalogEligibilityPairs(pairs);
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      const sep = parentHref.includes("?") ? "&" : "?";
      router.push(`${parentHref}${sep}added=${res.data.createdCount}`);
    } finally {
      setBusy(false);
    }
  };

  const emptyCopy =
    mode === "nationality"
      ? "All services are already linked."
      : "All nationalities are already linked.";

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        <Link href={parentHref} className="underline underline-offset-4">
          Cancel
        </Link>
      </p>
      <Card className="border-border overflow-hidden border">
        <CardHeader className="border-border bg-muted/20 space-y-4 border-b">
          <div>
            <CardTitle className="font-heading text-lg">
              {mode === "nationality" ? "Add services" : "Add nationalities"}
            </CardTitle>
            <CardDescription>
              Select the items to link, then confirm. Only unlinked items are shown.
            </CardDescription>
          </div>
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="catalog-picker-search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder={mode === "nationality" ? "Search services…" : "Search nationalities…"}
              className="pl-9"
              autoComplete="off"
              aria-label="Search"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <p className="text-destructive px-4 py-3 text-sm" role="alert">
              {error}
            </p>
          ) : null}
          {page.pageItems.length === 0 ? (
            <p className="text-muted-foreground px-4 py-6 text-center text-sm">
              {search.trim() ? "No matches." : emptyCopy}
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {page.pageItems.map((c) => {
                const key = mode === "nationality" ? (c as CatalogService).id : (c as CatalogNationality).code;
                const label =
                  mode === "nationality"
                    ? (c as CatalogService).name
                    : `${(c as CatalogNationality).name} (${(c as CatalogNationality).code})`;
                return (
                  <li key={key}>
                    {canWrite ? (
                      <label className="flex min-h-6 w-full cursor-pointer items-center gap-3 px-4 py-3">
                        <input
                          type="checkbox"
                          className="accent-primary size-4 shrink-0"
                          checked={selected.has(key)}
                          onChange={() => toggle(key)}
                          disabled={busy}
                          aria-label={label}
                        />
                        <span className="font-medium">{label}</span>
                      </label>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-3">
                        <span className="font-medium">{label}</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <ListPaginatorBar
            selectId="catalog-picker-page-size"
            page={page.page}
            setPage={setPage}
            pageSize={page.pageSize}
            onPageSizeChange={page.onPageSizeChange}
            total={page.total}
            disabled={busy}
          />
          {canWrite ? (
            <div className="border-border flex justify-end gap-2 border-t p-4">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => router.push(parentHref)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={busy || selected.size === 0}
                onClick={() => void addSelected()}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                Add selected ({selected.size})
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};
