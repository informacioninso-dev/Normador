"use client";

import { Children, cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import { useActionForm } from "@/components/action-form";

type ControlProps = { id?: string; name?: string; required?: boolean; "aria-describedby"?: string; "aria-invalid"?: boolean };
export function FormField({ label, children, labelClassName = "mb-2 block text-sm font-semibold text-moss" }: {
  label: ReactNode; children: ReactElement<ControlProps>; labelClassName?: string;
}) {
  const generatedId = useId();
  const control = Children.toArray(children).find(isValidElement) as ReactElement<ControlProps> | undefined;
  if (!control) throw new Error("El campo necesita un control de formulario.");
  const id = control.props.id ?? generatedId;
  const { errors } = useActionForm();
  const error = control.props.name ? errors[control.props.name] : undefined;
  const errorId = `${id}-error`;
  return <div>
    <label htmlFor={id} className={labelClassName}>{label}{control.props.required && <span className="ml-1" aria-label="obligatorio">*</span>}</label>
    {cloneElement(control, { id, "aria-invalid": error ? true : undefined, "aria-describedby": [control.props["aria-describedby"], error ? errorId : ""].filter(Boolean).join(" ") || undefined })}
    {error && <p id={errorId} className="mt-2 text-sm text-rose-800">{error}</p>}
  </div>;
}
