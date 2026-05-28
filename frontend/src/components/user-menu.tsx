"use client";

import { useTransition } from "react";

import { logoutAction } from "@/app/login/actions";

interface Props {
  username: string;
  isStaff: boolean;
}

export function UserMenu({ username, isStaff }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <p className="text-xs font-semibold text-ink">{username}</p>
        {isStaff ? <p className="text-[11px] text-ink/45">Admin</p> : null}
      </div>
      <button
        onClick={() => startTransition(() => logoutAction())}
        disabled={pending}
        className="rounded-full border border-black/8 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-sand disabled:opacity-50"
      >
        {pending ? "Saliendo..." : "Salir"}
      </button>
    </div>
  );
}
