import Link from "next/link";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    step: 1,
    kicker: "Step 1",
    title: "Nationality",
    body: "Tell us which passport you travel on so we only show eligible visa options.",
  },
  {
    step: 2,
    kicker: "Step 2",
    title: "Currency & visa type",
    body: "Choose how prices are shown, pick your visa, and enter your email so we can open your file.",
  },
  {
    step: 3,
    kicker: "Step 3",
    title: "Documents",
    body: "Upload what we ask for and confirm your passport details.",
  },
  {
    step: 4,
    kicker: "Step 4",
    title: "Secure payment",
    body: "Review your order and pay securely to begin processing.",
  },
  {
    step: 5,
    kicker: "Step 5",
    title: "Status",
    body: "Follow progress here instead of chasing updates by email.",
  },
] as const;

type ApplyStepsRailProps = {
  currentStep: 1 | 2 | 3 | 4 | 5;
  applicationId?: string;
  className?: string;
};

function hrefForStep(step: number, applicationId?: string): string | null {
  if (step === 1) return "/";
  if (step === 2) return "/";
  if (!applicationId) return null;
  if (step === 3) return `/apply/applications/${encodeURIComponent(applicationId)}`;
  if (step === 4) return `/apply/applications/${encodeURIComponent(applicationId)}/payment`;
  if (step === 5) return `/apply/applications/${encodeURIComponent(applicationId)}/submitted`;
  return null;
}

function stepState(step: number, currentStep: number): "completed" | "active" | "future" {
  if (step < currentStep) return "completed";
  if (step === currentStep) return "active";
  return "future";
}

function boxClasses(state: "completed" | "active" | "future"): string {
  if (state === "completed") {
    return "bg-secondary text-secondary-foreground border-secondary shadow-[0_10px_0_rgba(1,32,49,0.14)]";
  }
  if (state === "active") {
    return "bg-muted text-foreground border-secondary/60 shadow-[0_10px_0_rgba(1,32,49,0.14)]";
  }
  return "bg-primary text-primary-foreground border-secondary shadow-[0_10px_0_rgba(1,32,49,0.14)]";
}

export function ApplyStepsRail({ currentStep, applicationId, className }: ApplyStepsRailProps) {
  return (
    <nav className={cn("theme-client-rise", className)} aria-label="Application steps">
      <ol className="relative space-y-0">
        {STEPS.map((s, index) => {
          const state = stepState(s.step, currentStep);
          const href = hrefForStep(s.step, applicationId);
          const isLink = Boolean(href) && state !== "future";
          return (
            <li
              key={s.kicker}
              className={cn(
                "relative flex gap-5 pb-12 pl-2 sm:gap-7 sm:pl-0",
                index < STEPS.length - 1 &&
                  "before:absolute before:top-10 before:left-[1.15rem] before:h-[calc(100%-0.5rem)] before:w-0.5 before:bg-secondary/25 sm:before:left-[1.35rem]",
              )}
            >
              <span
                className={cn(
                  "font-heading relative z-[1] flex size-12 shrink-0 items-center justify-center rounded-[5px] border-[2.5px] text-base font-bold sm:size-[3.25rem] sm:text-lg",
                  boxClasses(state),
                )}
                aria-hidden
              >
                {s.step}
              </span>
              <div className="min-w-0 pt-1">
                <p className="text-secondary text-[10px] font-bold uppercase tracking-widest">{s.kicker}</p>
                {isLink ? (
                  <Link
                    href={href!}
                    className={cn(
                      "font-heading text-foreground mt-1 block text-xl font-semibold sm:text-2xl hover:underline underline-offset-4",
                    )}
                  >
                    {s.title}
                  </Link>
                ) : (
                  <div className={cn("font-heading text-foreground mt-1 block text-xl font-semibold sm:text-2xl")}>
                    {s.title}
                  </div>
                )}
                <p className="text-muted-foreground mt-2 max-w-[48ch] text-sm leading-relaxed sm:text-base">
                  {s.body}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

