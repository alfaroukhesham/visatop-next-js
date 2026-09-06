"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FC } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createDocumentType } from "@/lib/admin/catalog/document-type-mutations";
import { slugifyDocumentTypeLabel } from "@/lib/admin/catalog/document-type";

interface IDocumentRulesNewFormProps {
  canWrite: boolean;
}

export const DocumentRulesNewForm: FC<IDocumentRulesNewFormProps> = ({ canWrite }) => {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keyPreview = slugifyDocumentTypeLabel(label);

  const onSubmit = async () => {
    if (!canWrite) return;
    setBusy(true);
    setError(null);
    try {
      const res = await createDocumentType({
        label,
        description: description.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      router.push(`/admin/document-rules/${encodeURIComponent(res.data.document.key)}/assign`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        <Link href="/admin/document-rules" className="underline underline-offset-4">
          All documents
        </Link>
      </p>
      <Card className="border-border overflow-hidden border">
        <CardHeader className="border-border bg-muted/20 border-b">
          <CardTitle className="font-heading text-lg">Add document</CardTitle>
          <CardDescription>
            Create an extra document, then assign it in bulk. After that, add or edit countries
            from the document’s assignment list. Passport and personal photo cannot be added here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <div className="space-y-1">
            <Label htmlFor="new-doc-label">Name</Label>
            <Input
              id="new-doc-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Invitation letter"
              disabled={!canWrite || busy}
            />
            {keyPreview ? (
              <p className="text-muted-foreground font-mono text-xs">Key: {keyPreview}</p>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-doc-description">Description (optional)</Label>
            <Input
              id="new-doc-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Shown to the applicant on the upload slot"
              disabled={!canWrite || busy}
            />
          </div>
          <Button
            type="button"
            disabled={!canWrite || busy || !label.trim()}
            onClick={() => void onSubmit()}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Create and continue
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
