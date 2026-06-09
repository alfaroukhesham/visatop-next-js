import { CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatusBadge({ label, value }: { label: string; value: string }) {
  const isGood = [
    "paid",
    "in_progress",
    "awaiting_authority",
    "completed",
    "fulfilled",
    "retained",
  ].includes(value);
  const isWarn = ["checkout_created", "refund_pending", "pending"].includes(value);
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-1 text-xs font-bold font-mono rounded-none",
          isGood
            ? "bg-success/10 text-success border border-success/30"
            : isWarn
              ? "bg-warning/10 text-warning border border-warning/30"
              : "bg-muted text-muted-foreground border border-border",
        )}
      >
        {isGood ? <CheckCircle2 className="size-3" /> : isWarn ? <Clock className="size-3" /> : null}
        {value}
      </span>
    </div>
  );
}

export function ProfileRow({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("mt-0.5 text-sm text-foreground", mono && "font-mono")}>
        {value ?? <span className="text-muted-foreground/50 italic">, </span>}
      </dd>
    </div>
  );
}
