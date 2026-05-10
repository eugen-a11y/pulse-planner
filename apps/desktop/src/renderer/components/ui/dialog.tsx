import * as DialogPrimitive from "@radix-ui/react-dialog";
import { type ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export function Dialog({ open, onOpenChange, children }: {
  open: boolean; onOpenChange(o: boolean): void; children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 bg-black/30 z-40" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "rounded-lg bg-white shadow-xl border border-[var(--border)] p-6 min-w-[320px] max-w-[560px]",
          )}
        >
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
