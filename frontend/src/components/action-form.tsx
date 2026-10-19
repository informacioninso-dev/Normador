"use client";

import { createContext, useContext, useId, useRef, useState, useTransition, type FormHTMLAttributes } from "react";

export type FormResult = { error?: string; fieldErrors?: Record<string, string>; success?: string };
export type FormAction = (data: FormData) => Promise<FormResult | void>;
const FormContext = createContext({ pending: false, errors: {} as Record<string, string> });
export const useActionForm = () => useContext(FormContext);

/** Errors stay in the mounted form, preserving typed values and selected files. */
export function ActionForm({ action, children, ...props }: Omit<FormHTMLAttributes<HTMLFormElement>, "action"> & { action: FormAction }) {
  const { encType: _encType, method: _method, ...formProps } = props;
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<FormResult>({});
  const errorId = useId();
  const alert = useRef<HTMLDivElement>(null);
  return <FormContext.Provider value={{ pending, errors: result.fieldErrors ?? {} }}>
    <form {...formProps} action={action as (data: FormData) => Promise<void>} aria-busy={pending} onSubmit={(event) => {
      props.onSubmit?.(event);
      if (event.defaultPrevented) return;
      event.preventDefault();
      if (pending) return;
      const form = event.currentTarget;
      const submitter = (event.nativeEvent as SubmitEvent).submitter;
      const data = new FormData(form, submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement ? submitter : undefined);
      startTransition(async () => {
        try {
          const next = await action(data);
          setResult(next ?? {});
          if (next?.error) {
            requestAnimationFrame(() => {
              const name = Object.keys(next.fieldErrors ?? {})[0];
              const field = name ? form.querySelector<HTMLElement>(`[name="${CSS.escape(name)}"]`) : null;
              (field ?? alert.current)?.focus();
            });
          }
        } catch (error) {
          if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) throw error;
          setResult({ error: "No se pudo completar la solicitud. Conservamos lo escrito para que puedas reintentarlo." });
        }
      });
    }}>
      {result.error && <div ref={alert} id={errorId} role="alert" tabIndex={-1} className="mb-4 rounded-xl bg-rose-50 p-3 text-rose-900">{result.error}</div>}
      {result.success && <p role="status">{result.success}</p>}
      {children}
    </form>
  </FormContext.Provider>;
}
