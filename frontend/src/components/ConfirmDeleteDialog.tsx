"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";

type ConfirmDeleteDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
};

export function ConfirmDeleteDialog({
  open,
  onClose,
  onConfirm,
  title,
}: ConfirmDeleteDialogProps) {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} size="sm" hideClose>
      <div className="flex flex-col items-center text-center pt-2">
        {/* Icon */}
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 mb-5">
          <AlertTriangle className="h-7 w-7 text-danger" />
        </div>

        {/* Text */}
        <h3 className="font-display text-lg font-medium text-ink-9">
          Delete post?
        </h3>
        <p className="mt-2 text-sm text-ink-6 leading-relaxed max-w-xs">
          <span className="font-medium text-ink-8">&ldquo;{title}&rdquo;</span>{" "}
          will be permanently removed. This action cannot be undone.
        </p>

        {/* Buttons */}
        <div className="mt-7 flex w-full gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="flex-1 rounded-xl border border-ink-2 bg-paper-0 px-4 py-2.5 text-sm font-medium text-ink-7 hover:bg-paper-2 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={deleting}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-danger px-4 py-2.5 text-sm font-medium text-white hover:bg-danger/90 transition-colors disabled:opacity-70"
          >
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting…
              </>
            ) : (
              "Delete"
            )}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
