"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import { deleteUser } from "@/app/(app)/admin/actions";
import { TrashIcon } from "./icons";
import { buttonStyles, cx } from "./ui";

const noop = () => () => {};

/** Shows a UTC timestamp in the viewer's time zone; the server render shows the UTC date. */
export function LocalDateTime({ iso }: { iso: string | null }) {
  const isClient = useSyncExternalStore(noop, () => true, () => false);
  if (!iso) return <span className="text-ink-3">Never</span>;
  const date = new Date(iso);
  const text = isClient
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date)
    : `${iso.slice(0, 10)} UTC`;
  return <time dateTime={iso}>{text}</time>;
}

export function DeleteUserButton({ userId, email }: { userId: string; email: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(deleteUser, {});
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={cx(buttonStyles.ghost, "text-bad hover:bg-bad-soft hover:text-bad")} aria-label={`Delete ${email}`}>
        <TrashIcon className="size-4" />
      </button>
    );
  }
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex items-center gap-1">
        <button type="submit" disabled={pending} className={cx(buttonStyles.danger, "px-3 py-1.5 text-xs")}>
          {pending ? "Deleting…" : "Delete account"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className={cx(buttonStyles.ghost, "text-xs")}>
          Cancel
        </button>
      </div>
      {state.error ? <p className="text-xs text-bad" role="alert">{state.error}</p> : null}
    </form>
  );
}
