"use client";

import { useFormStatus } from "react-dom";
import { useActionForm } from "@/components/action-form";

export function SubmitButton({
  label,
  pendingLabel,
  className = "",
  disabled = false,
}: {
  label: string;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const native = useFormStatus();
  const managed = useActionForm();
  const pending = native.pending || managed.pending;

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={[
        "rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-sand transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      ].join(" ")}
    >
      {pending ? pendingLabel ?? "Procesando..." : label}
    </button>
  );
}
