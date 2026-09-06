"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FC } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { DocumentRulesDeleteDialog } from "@/components/admin/document-rules-delete-dialog";
import { ListPaginatorBar } from "@/components/admin/list-paginator-bar";
import { usePaginatedList } from "@/components/admin/use-paginated-list";
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
import { listDocumentTypes } from "@/lib/admin/catalog/document-type-mutations";
import type { TCatalogDocumentType } from "@/lib/admin/catalog/document-type";

interface IDocumentRulesWorkspaceProps {
  canWrite: boolean;
}

export const DocumentRulesWorkspace: FC<IDocumentRulesWorkspaceProps> = ({ canWrite }) => {
  const [documents, setDocuments] = useState<TCatalogDocumentType[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<TCatalogDocumentType | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const res = await listDocumentTypes();
      if (!active) return;
      if (!res.ok) {
        setError(res.error.message);
        setDocuments([]);
      } else {
        setError(null);
        setDocuments(res.data.documents);
      }
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter(
      (d) => d.label.toLowerCase().includes(q) || d.key.toLowerCase().includes(q),
    );
  }, [documents, search]);

  const { setPage, ...page } = usePaginatedList(filtered);

  return (
    <Card className="border-border overflow-hidden border">
      <CardHeader className="border-border bg-muted/20 space-y-4 border-b">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="font-heading text-lg">Documents</CardTitle>
            <CardDescription>
              Extra documents you can assign to countries. Passport and personal photo are always
              required and are not listed here.
            </CardDescription>
          </div>
          {canWrite ? (
            <Link href="/admin/document-rules/new" className={cn(buttonVariants(), "gap-2")}>
              <Plus className="size-4" />
              Add document
            </Link>
          ) : null}
        </div>
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="document-rules-search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search documents…"
            className="pl-9"
            autoComplete="off"
            aria-label="Search documents"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {error ? (
          <p className="text-destructive px-4 py-3 text-sm" role="alert">
            {error}
          </p>
        ) : null}
        {!loaded ? (
          <p className="text-muted-foreground flex items-center gap-2 px-4 py-6 text-sm">
            <Loader2 className="size-4 animate-spin" /> Loading documents…
          </p>
        ) : (
          <>
            <ul className="divide-border divide-y">
              {page.pageItems.length === 0 ? (
                <li className="text-muted-foreground px-4 py-6 text-center text-sm">
                  {search.trim()
                    ? "No documents match your search."
                    : "No extra documents yet. Add a document to start assigning it."}
                </li>
              ) : null}
              {page.pageItems.map((doc) => (
                <li key={doc.key} className="flex items-stretch">
                  <Link
                    href={`/admin/document-rules/${encodeURIComponent(doc.key)}`}
                    className="hover:bg-muted/30 flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3 px-4 py-4"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{doc.label}</p>
                      <p className="text-muted-foreground font-mono text-xs">{doc.key}</p>
                      {doc.description ? (
                        <p className="text-muted-foreground mt-1 text-sm">{doc.description}</p>
                      ) : null}
                    </div>
                    <p className="text-muted-foreground text-sm tabular-nums">
                      {doc.pairCount.toLocaleString()}{" "}
                      {doc.pairCount === 1 ? "assignment" : "assignments"}
                    </p>
                  </Link>
                  {canWrite ? (
                    <div className="flex items-center pr-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setPendingDelete(doc)}
                      >
                        Delete
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            <ListPaginatorBar
              selectId="document-rules-list-page-size"
              page={page.page}
              setPage={setPage}
              pageSize={page.pageSize}
              onPageSizeChange={page.onPageSizeChange}
              total={page.total}
              loading={!loaded}
            />
          </>
        )}
      </CardContent>
      <DocumentRulesDeleteDialog
        document={pendingDelete}
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        onDeleted={(result) => {
          setDocuments((prev) => prev.filter((doc) => doc.key !== result.key));
          setPendingDelete(null);
        }}
      />
    </Card>
  );
};
