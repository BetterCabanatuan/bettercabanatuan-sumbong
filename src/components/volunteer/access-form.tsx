"use client";

import { useEffect, useRef, useState } from "react";
import { setUserAccess } from "@/app/v/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ActionForm, SubmitButton } from "@/components/volunteer/action-form";

/**
 * One account's role picker. Save appears only once the choice differs from the current role,
 * and removing an active Volunteer's access asks first. The form stays the server action;
 * the dialog's confirm button submits it.
 */
export function AccessForm({
  userId,
  name,
  current,
  active,
  noAccessLabel,
  roles,
}: {
  userId: string;
  name: string;
  /** The active role's id, or null when the account has no access. */
  current: string | null;
  active: boolean;
  /** Text of the "none" option, or null when this viewer can't choose it. */
  noAccessLabel: string | null;
  roles: { id: string; name: string }[];
}) {
  const selectRef = useRef<HTMLSelectElement>(null);
  const initial = current ?? "none";
  const [value, setValue] = useState(initial);
  const [confirming, setConfirming] = useState(false);

  // ActionForm resets the form after a save; read the select back so Save hides again.
  useEffect(() => {
    const form = selectRef.current?.form;
    if (!form) return;
    const onReset = () => queueMicrotask(() => setValue(selectRef.current?.value ?? initial));
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [initial]);

  const changed = value !== initial;
  const removing = changed && value === "none" && active;

  return (
    <ActionForm action={setUserAccess} success="Saved." className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="user_id" value={userId} />
      <NativeSelect
        ref={selectRef}
        name="role_id"
        defaultValue={initial}
        aria-label={`Role for ${name}`}
        onChange={(event) => setValue(event.target.value)}
      >
        {noAccessLabel && <NativeSelectOption value="none">{noAccessLabel}</NativeSelectOption>}
        {roles.map((role) => (
          <NativeSelectOption key={role.id} value={role.id}>
            {role.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {changed &&
        (removing ? (
          <Button type="button" variant="outline" className="motion-safe:animate-rise-in" onClick={() => setConfirming(true)}>
            Save
          </Button>
        ) : (
          <SubmitButton variant="outline" className="motion-safe:animate-rise-in">
            Save
          </SubmitButton>
        ))}
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent finalFocus={selectRef}>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {name}’s access?</AlertDialogTitle>
            <AlertDialogDescription>
              They’ll keep their account and their own Reports, but lose the Volunteer console. You can give a role back later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirming(false);
                selectRef.current?.form?.requestSubmit();
              }}
            >
              Remove access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ActionForm>
  );
}
