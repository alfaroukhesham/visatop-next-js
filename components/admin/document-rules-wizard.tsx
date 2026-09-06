"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FC } from "react";
import { Loader2 } from "lucide-react";
import {
  DocumentRulesCountryPicker,
  pairKey,
  type TDocumentRulesPickerCountry,
} from "@/components/admin/document-rules-country-picker";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { TCatalogDocumentType } from "@/lib/admin/catalog/document-type";
import {
  assignDocumentRequirements,
  previewDocumentRequirements,
  type TDocumentRequirementAssignPreview,
} from "@/lib/admin/catalog/document-requirement-mutations";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, title: "Role" },
  { id: 2, title: "Countries" },
  { id: 3, title: "Review" },
] as const;

interface IDocumentRulesWizardProps {
  document: TCatalogDocumentType;
  canWrite: boolean;
}

export const DocumentRulesWizard: FC<IDocumentRulesWizardProps> = ({ document, canWrite }) => {
  const router = useRouter();
  const [step, setStep] = useState<(typeof STEPS)[number]["id"]>(1);
  const [role, setRole] = useState<"required" | "additional">("required");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignBusy, setAssignBusy] = useState<"preview" | "assign" | null>(null);
  const [pickerRefreshKey, setPickerRefreshKey] = useState(0);
  const [preview, setPreview] = useState<TDocumentRequirementAssignPreview | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const documentHref = `/admin/document-rules/${encodeURIComponent(document.key)}`;
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const flash = (text: string, err = false) => {
    setBanner({ type: err ? "err" : "ok", text });
    setTimeout(() => setBanner(null), 4000);
  };

  const togglePair = (code: string, serviceId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const key = pairKey(code, serviceId);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleCountry = (country: TDocumentRulesPickerCountry) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const keys = country.services.map((s) => pairKey(country.code, s.id));
      const allSelected = keys.length > 0 && keys.every((k) => next.has(k));
      for (const k of keys) {
        if (allSelected) next.delete(k);
        else next.add(k);
      }
      return next;
    });
  };

  const buildPairs = () =>
    [...selected].map((key) => {
      const [nationalityCode, serviceId] = key.split(":");
      return { nationalityCode, serviceId };
    });

  const openPreview = async () => {
    const pairs = buildPairs();
    if (pairs.length === 0) return;
    setAssignBusy("preview");
    try {
      const res = await previewDocumentRequirements({
        documentType: document.key,
        role,
        pairs,
      });
      if (!res.ok) {
        flash(res.error.message, true);
        return;
      }
      setPreview(res.data);
      setPreviewOpen(true);
    } finally {
      setAssignBusy(null);
    }
  };

  const confirmAssign = async () => {
    const pairs = buildPairs();
    if (pairs.length === 0) return;
    setAssignBusy("assign");
    try {
      const res = await assignDocumentRequirements({
        documentType: document.key,
        role,
        pairs,
      });
      if (!res.ok) {
        flash(res.error.message, true);
        return;
      }
      setPreviewOpen(false);
      setPreview(null);
      setSelected(new Set());
      setPickerRefreshKey((n) => n + 1);
      router.push(documentHref);
    } finally {
      setAssignBusy(null);
    }
  };

  return (
    <div className="space-y-8">
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

      <p className="text-muted-foreground text-sm">
        <Link href={documentHref} className="underline underline-offset-4">
          {document.label}
        </Link>
        <span className="px-2">·</span>
        <Link href="/admin/document-rules" className="underline underline-offset-4">
          All documents
        </Link>
      </p>

      <ol className="flex flex-wrap gap-2" aria-label="Wizard steps">
        {STEPS.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium",
                step === item.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
              onClick={() => setStep(item.id)}
            >
              {item.id}. {item.title}
            </button>
          </li>
        ))}
      </ol>

      <Card className="border-border overflow-hidden border">
        <CardHeader className="border-border bg-muted/20 border-b">
          <CardTitle className="font-heading text-lg">{document.label}</CardTitle>
          <CardDescription>
            {document.description ||
              "Assign this document to a country’s eligible products. Passport and personal photo stay required."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-4">
          {step === 1 ? (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                Every application always needs passport + personal photo. Those cannot be turned off.
              </p>
              <div className="space-y-1">
                <Label htmlFor="doc-rules-role">Role on apply</Label>
                <select
                  id="doc-rules-role"
                  className="border-input bg-background h-9 w-56 rounded-md border px-2 text-sm"
                  value={role}
                  onChange={(e) => setRole(e.target.value as "required" | "additional")}
                  disabled={!canWrite}
                >
                  <option value="required">Required</option>
                  <option value="additional">Additional</option>
                </select>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <DocumentRulesCountryPicker
              canWrite={canWrite}
              busy={assignBusy !== null}
              selected={selected}
              onTogglePair={togglePair}
              onToggleCountry={toggleCountry}
              onAddEligibility={(nationalityCode) => {
                router.push(
                  `/admin/catalog?prefillNat=${encodeURIComponent(nationalityCode)}#catalog-eligibility`,
                );
              }}
              refreshKey={pickerRefreshKey}
            />
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Document</dt>
                  <dd className="font-medium">{document.label}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Role</dt>
                  <dd className="capitalize">{role}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Selected pairs</dt>
                  <dd className="font-medium">{selected.size}</dd>
                </div>
              </dl>
              {canWrite ? (
                <Button
                  type="button"
                  disabled={selected.size === 0 || assignBusy !== null}
                  onClick={() => void openPreview()}
                >
                  {assignBusy === "preview" ? <Loader2 className="size-4 animate-spin" /> : null}
                  Preview and assign…
                </Button>
              ) : (
                <p className="text-muted-foreground text-sm">You can view this document but not assign it.</p>
              )}
            </div>
          ) : null}

          <div className="flex flex-wrap justify-between gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={step === 1}
              onClick={() => setStep((s) => (s === 1 ? 1 : ((s - 1) as 1 | 2 | 3)))}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={step === 3}
              onClick={() => setStep((s) => (s === 3 ? 3 : ((s + 1) as 1 | 2 | 3)))}
            >
              Continue
            </Button>
          </div>
        </CardContent>
      </Card>

      <DocumentRulesAssignPreviewDialog
        open={previewOpen}
        onOpenChange={(open) => {
          if (assignBusy === "assign") return;
          setPreviewOpen(open);
          if (!open) setPreview(null);
        }}
        documentLabel={document.label}
        role={role}
        preview={preview}
        confirmBusy={assignBusy === "assign"}
        onConfirm={() => void confirmAssign()}
      />
    </div>
  );
};

interface IDocumentRulesAssignPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentLabel: string;
  role: "required" | "additional";
  preview: TDocumentRequirementAssignPreview | null;
  confirmBusy: boolean;
  onConfirm: () => void;
}

const DocumentRulesAssignPreviewDialog: FC<IDocumentRulesAssignPreviewDialogProps> = ({
  open,
  onOpenChange,
  documentLabel,
  role,
  preview,
  confirmBusy,
  onConfirm,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>Assign {documentLabel}?</DialogTitle>
          <DialogDescription>
            Review what this bulk assign will change before it writes.
          </DialogDescription>
        </DialogHeader>
        {preview ? (
          <div className="space-y-3">
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Role</dt>
                <dd className="capitalize">{role}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Selected pairs</dt>
                <dd className="font-medium">{preview.pairCount}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">New assignments</dt>
                <dd className="font-medium">{preview.willInsert}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Role updates</dt>
                <dd className="font-medium">{preview.willUpdateRole}</dd>
              </div>
            </dl>
            {preview.willCreateEligibility > 0 ? (
              <Alert>
                <AlertTitle>Eligibility links will be created</AlertTitle>
                <AlertDescription>
                  This will also create Eligibility admin links for {preview.willCreateEligibility}{" "}
                  pairs. It does not set prices — products only appear on apply when a catalog price
                  exists.
                </AlertDescription>
              </Alert>
            ) : null}
            {preview.pairsWithoutPrice > 0 ? (
              <Alert>
                <AlertTitle>Some pairs have no price</AlertTitle>
                <AlertDescription>
                  {preview.pairsWithoutPrice} of these pairs have no catalog price and stay hidden on
                  apply until you add a price (Pricing or sheet import).
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={confirmBusy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={!preview || confirmBusy} onClick={onConfirm}>
            {confirmBusy ? <Loader2 className="size-4 animate-spin" /> : null}
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
