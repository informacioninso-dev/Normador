import type { FormHTMLAttributes, ReactNode } from "react";
import { ActionForm, type FormAction } from "@/components/action-form";

export function RoleForm({ allowed, children, ...props }: Omit<FormHTMLAttributes<HTMLFormElement>, "action"> & { action?: string | FormAction; allowed: boolean; children: ReactNode }) {
  if (typeof props.action === "function") {
    delete props.encType;
    delete props.method;
  }
  if (typeof props.action === "function") {
    return <ActionForm {...props} action={props.action}><fieldset disabled={!allowed} className="contents">{children}</fieldset></ActionForm>;
  }
  return (
    <form {...props} action={typeof props.action === "string" ? props.action : undefined}>
      <fieldset disabled={!allowed} className="contents">
        {children}
      </fieldset>
    </form>
  );
}
