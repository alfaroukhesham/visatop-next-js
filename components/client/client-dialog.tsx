"use client";

import type { ComponentProps, FC, ReactNode } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { ClientButton } from "@/components/client/client-button";
import { cn } from "@/lib/utils";

/**
 * Customer apply/track dialog. Portals to `document.body`, so every surface
 * carries `.theme-client` — otherwise shadcn tokens resolve to the admin theme.
 */

export const ClientDialog = DialogPrimitive.Root;

export const ClientDialogTrigger = DialogPrimitive.Trigger;

export const ClientDialogClose = DialogPrimitive.Close;

type TClientDialogOverlayProps = DialogPrimitive.Backdrop.Props;

const ClientDialogOverlay: FC<TClientDialogOverlayProps> = ({ className, ...props }) => (
  <DialogPrimitive.Backdrop
    data-slot="client-dialog-overlay"
    className={cn(
      "theme-client fixed inset-0 isolate z-50 bg-[#012031]/45 duration-100 supports-backdrop-filter:backdrop-blur-[2px]",
      "data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
      className,
    )}
    {...props}
  />
);

interface IClientDialogContentProps extends DialogPrimitive.Popup.Props {
  showCloseButton?: boolean;
}

export const ClientDialogContent: FC<IClientDialogContentProps> = ({
  className,
  children,
  showCloseButton = true,
  ...props
}) => (
  <DialogPrimitive.Portal>
    <ClientDialogOverlay />
    <DialogPrimitive.Popup
      data-slot="client-dialog-content"
      className={cn(
        "theme-client text-foreground fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-5",
        "rounded-[20px_0_20px_0] border-[3px] border-secondary/40 bg-card p-6 text-base shadow-[0_28px_72px_rgba(1,32,49,0.22)] outline-none sm:max-w-md sm:p-8",
        "duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton ? (
        <DialogPrimitive.Close
          data-slot="client-dialog-close"
          render={
            <ClientButton
              variant="ghost"
              className="text-secondary hover:bg-accent absolute top-3 right-3 size-9 min-w-0 rounded-[5px] p-0"
            />
          }
        >
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      ) : null}
    </DialogPrimitive.Popup>
  </DialogPrimitive.Portal>
);

type TClientDialogHeaderProps = ComponentProps<"div">;

export const ClientDialogHeader: FC<TClientDialogHeaderProps> = ({ className, ...props }) => (
  <div data-slot="client-dialog-header" className={cn("flex flex-col gap-2 pr-8", className)} {...props} />
);

interface IClientDialogFooterProps extends ComponentProps<"div"> {
  children: ReactNode;
}

export const ClientDialogFooter: FC<IClientDialogFooterProps> = ({ className, children, ...props }) => (
  <div
    data-slot="client-dialog-footer"
    className={cn("pt-1", className)}
    {...props}
  >
    {children}
  </div>
);

export const ClientDialogTitle: FC<DialogPrimitive.Title.Props> = ({ className, ...props }) => (
  <DialogPrimitive.Title
    data-slot="client-dialog-title"
    className={cn("font-heading text-foreground text-xl leading-tight font-semibold", className)}
    {...props}
  />
);

export const ClientDialogDescription: FC<DialogPrimitive.Description.Props> = ({ className, ...props }) => (
  <DialogPrimitive.Description
    data-slot="client-dialog-description"
    className={cn("text-muted-foreground text-sm leading-relaxed", className)}
    {...props}
  />
);
