"use client";

import { useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  cannotSummary,
  describeChanges,
  diffPermissions,
  groupAreas,
  permissionName,
  sameSet,
  togglePermissions,
} from "@/lib/permission-diff";
import { PERMISSION_ACTIONS, RISKY_ACTIONS } from "@/lib/permissions";
import type { Permission, PermissionAction, PermissionArea, PermissionInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

/** What a new role starts with, and what "Blank" in Start from goes back to. */
const BLANK: Permission[] = ["reports.view", "digests.view"];

const isRisky = (action: PermissionAction) => RISKY_ACTIONS.includes(action);

/**
 * The role editor's grid of areas × actions. A dash marks an action the area doesn't have.
 * Any action in an area turns on its View (you can't edit what you can't open), and
 * turning View off clears the row. Selected keys submit as `permissions` form values, rendered
 * once; the table (md and up) and the accordion (phones) share one state and one `update()`.
 */
export function PermissionMatrix({
  permissions,
  defaultSelected,
  disabled = false,
  roles = [],
  editing = false,
  memberCount = 0,
  isMine = false,
}: {
  permissions: PermissionInfo[];
  /** The saved set (or the starting set of a new role). */
  defaultSelected: Permission[];
  disabled?: boolean;
  /** Other roles that "Start from" can copy. */
  roles?: { id: string; name: string; permissions: Permission[] }[];
  /** An existing role: shows what will change against the saved set. */
  editing?: boolean;
  /** Active people who hold this role. */
  memberCount?: number;
  /** The viewer holds this role. */
  isMine?: boolean;
}) {
  const [selected, setSelected] = useState(() => new Set(defaultSelected));
  // What the grid looked like when it was last filled in whole (page load or Start from),
  // to tell whether the user has edited it since.
  const [baseline, setBaseline] = useState(() => new Set(defaultSelected));
  const [source, setSource] = useState("");
  const [copiedFrom, setCopiedFrom] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ id: number; keys: ReadonlySet<Permission> }>({ id: 0, keys: new Set() });

  const cell = new Map(permissions.map((p) => [`${p.resource}.${p.action}`, p]));
  const universe = permissions.map((p) => p.key);
  const groups = groupAreas([...new Set(permissions.map((p) => p.resource))]);
  const actions = PERMISSION_ACTIONS.filter((action) => permissions.some((p) => p.action === action.key));
  const inArea = (area: PermissionArea) => permissions.filter((p) => p.resource === area).map((p) => p.key);
  const inAction = (action: string) => permissions.filter((p) => p.action === action).map((p) => p.key);

  function update(keys: Permission[], on: boolean) {
    setSelected((current) => togglePermissions(current, keys, on, universe));
    setFlash((current) => (current.keys.size > 0 ? { id: current.id, keys: new Set() } : current));
  }

  function startFrom(id: string) {
    const role = roles.find((r) => r.id === id);
    const next = new Set(role ? role.permissions.filter((k) => universe.includes(k)) : BLANK);
    const changed = diffPermissions(selected, next);
    setFlash((current) => ({ id: current.id + 1, keys: new Set([...changed.added, ...changed.removed]) }));
    setSelected(next);
    setBaseline(next);
    setSource(id);
    setCopiedFrom(role?.name ?? null);
    setAsking(null);
  }

  function chooseSource(id: string) {
    if (id !== source && !sameSet(selected, baseline)) setAsking(id);
    else startFrom(id);
  }

  const all = (keys: Permission[]) => keys.length > 0 && keys.every((k) => selected.has(k));
  const diff = diffPermissions(defaultSelected, selected);
  const lost = isMine ? diff.removed.filter((k) => k === "roles.edit" || k === "roles.view").map(permissionName) : [];
  const changes = editing && !disabled ? describeChanges(diff, memberCount) : "";
  const warning = lost.length > 0 ? `You’ll lose: ${lost.join(", ")}.` : "";
  const cannot = cannotSummary(selected, universe);
  const askingRole = roles.find((r) => r.id === asking);

  return (
    <div className="flex flex-col gap-3">
      {/* The only inputs that submit; both layouts below are controls over `selected`. */}
      {[...selected].map((key) => (
        <input key={key} type="hidden" name="permissions" value={key} />
      ))}

      {!disabled && roles.length > 0 && (
        <Field className="gap-1.5">
          <FieldLabel htmlFor="role-start-from">Start from</FieldLabel>
          <NativeSelect id="role-start-from" value={source} onChange={(event) => chooseSource(event.target.value)}>
            <NativeSelectOption value="">Blank</NativeSelectOption>
            {roles.map((role) => (
              <NativeSelectOption key={role.id} value={role.id}>
                {role.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <p className="min-h-5 text-sm text-muted-foreground" role="status">
            {copiedFrom && `Copied from ${copiedFrom}. Adjust, then save.`}
          </p>
        </Field>
      )}

      <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b bg-muted">
              <th scope="col" className="sticky left-0 z-10 bg-muted px-3 py-2 text-left font-medium">
                Area
              </th>
              {actions.map((action, i) => (
                <th
                  key={action.key}
                  scope="col"
                  className={cn(
                    "px-2 py-2 font-medium",
                    isRisky(action.key) && "bg-destructive/10",
                    i > 0 && isRisky(action.key) !== isRisky(actions[i - 1].key) && "border-l-2",
                  )}
                >
                  <label className="flex flex-col items-center gap-1.5">
                    {action.label}
                    <Checkbox
                      checked={all(inAction(action.key))}
                      onCheckedChange={(on) => update(inAction(action.key), on)}
                      disabled={disabled}
                      aria-label={`${action.label} in every area`}
                    />
                  </label>
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.key} className="border-b last:border-0">
              <tr>
                <th
                  scope="rowgroup"
                  className="sticky left-0 z-10 bg-background px-3 pt-2.5 pb-1 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase"
                >
                  {group.label}
                </th>
                <td colSpan={actions.length} className="bg-background" />
              </tr>
              {group.areas.map((area) => {
                const row = inArea(area.key);
                return (
                  <tr key={area.key} className="border-t first:border-t-0">
                    <th scope="row" className="sticky left-0 z-10 bg-card px-3 py-2.5 text-left font-medium">
                      <label className="flex items-center gap-2">
                        <Checkbox
                          checked={all(row)}
                          onCheckedChange={(on) => update(row, on)}
                          disabled={disabled}
                          aria-label={`Everything in ${area.label}`}
                        />
                        {area.label}
                      </label>
                    </th>
                    {actions.map((action, i) => {
                      const permission = cell.get(`${area.key}.${action.key}`);
                      return (
                        <td
                          key={action.key}
                          className={cn(
                            "relative px-2 py-2.5 text-center",
                            isRisky(action.key) && "bg-destructive/5",
                            i > 0 && isRisky(action.key) !== isRisky(actions[i - 1].key) && "border-l-2",
                          )}
                        >
                          {permission ? (
                            <span className="inline-flex" title={permission.description}>
                              <Checkbox
                                checked={selected.has(permission.key)}
                                onCheckedChange={(on) => update([permission.key], on)}
                                disabled={disabled}
                                aria-label={permission.label}
                              />
                            </span>
                          ) : (
                            <span className="text-muted-foreground" aria-label={`${area.label} has no ${action.label}`}>
                              —
                            </span>
                          )}
                          {permission && flash.keys.has(permission.key) && <Flash key={flash.id} />}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>

      <div className="flex flex-col gap-4 md:hidden">
        {groups.map((group) => (
          <section key={group.key} className="flex flex-col gap-1" aria-label={group.label}>
            <h3 className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{group.label}</h3>
            <Accordion multiple className="rounded-lg border bg-card px-3">
              {group.areas.map((area) => {
                const row = inArea(area.key);
                const count = row.filter((k) => selected.has(k)).length;
                return (
                  <AccordionItem key={area.key} value={area.key}>
                    <div className="flex items-center gap-1">
                      <span className="flex size-11 shrink-0 items-center justify-center">
                        <Checkbox
                          checked={all(row)}
                          onCheckedChange={(on) => update(row, on)}
                          disabled={disabled}
                          aria-label={`Everything in ${area.label}`}
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <AccordionTrigger className="min-h-11 items-center">
                          <span>
                            {area.label}
                            <span className="font-normal text-muted-foreground tabular-nums">
                              {" "}
                              · {count} of {row.length}
                            </span>
                          </span>
                        </AccordionTrigger>
                      </div>
                    </div>
                    <AccordionContent>
                      <ul className="grid grid-cols-2 gap-2">
                        {actions.flatMap((action) => {
                          const permission = cell.get(`${area.key}.${action.key}`);
                          if (!permission) return [];
                          return (
                            <li key={action.key}>
                              <label
                                className={cn(
                                  "relative flex min-h-11 items-center gap-3 rounded-md border px-3 text-sm",
                                  isRisky(action.key) && "bg-destructive/5",
                                )}
                              >
                                <Checkbox
                                  checked={selected.has(permission.key)}
                                  onCheckedChange={(on) => update([permission.key], on)}
                                  disabled={disabled}
                                  aria-label={permission.label}
                                />
                                {action.label}
                                {flash.keys.has(permission.key) && <Flash key={flash.id} />}
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </section>
        ))}
      </div>

      <div className={cn("flex flex-col gap-1 text-sm text-muted-foreground", disabled && "sr-only")}>
        <p>
          <span className="tabular-nums">
            {selected.size} of {permissions.length}
          </span>{" "}
          permissions. Checking any action also allows View; unchecking View clears the row.
        </p>
        {cannot && <p>{cannot}</p>}
      </div>

      <PendingChanges changes={changes} warning={warning} />

      <details className="rounded-lg border px-3 py-2 text-sm">
        <summary className="cursor-pointer font-medium">What each permission allows</summary>
        <dl className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-[minmax(10rem,auto)_1fr]">
          {groups
            .flatMap((group) => group.areas)
            .flatMap((area) =>
              permissions
                .filter((p) => p.resource === area.key)
                .map((p) => (
                  <div key={p.key} className="contents">
                    <dt className="font-medium">{p.label}</dt>
                    <dd className="text-muted-foreground">{p.description}</dd>
                  </div>
                )),
            )}
        </dl>
      </details>

      <AlertDialog open={asking !== null} onOpenChange={(open) => !open && setAsking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace your changes?</AlertDialogTitle>
            <AlertDialogDescription>
              {askingRole ? `Starting from ${askingRole.name}` : "Starting from Blank"} replaces the permissions you have
              checked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my changes</AlertDialogCancel>
            <AlertDialogAction onClick={() => asking !== null && startFrom(asking)}>Replace</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** A tint over a cell that Start from just changed; fades out and is not rendered at all for reduced motion. */
function Flash() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 hidden bg-sun/30 motion-safe:block motion-safe:animate-flash-fade"
    />
  );
}

/**
 * What saving will change, announced politely. The row expands with a short grid-rows
 * transition instead of popping in, and keeps its last text while it collapses.
 */
function PendingChanges({ changes, warning }: { changes: string; warning: string }) {
  const [shown, setShown] = useState({ changes, warning });
  if ((changes || warning) && (changes !== shown.changes || warning !== shown.warning)) setShown({ changes, warning });
  const open = Boolean(changes || warning);
  return (
    <div aria-live="polite" data-slot="pending-changes">
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity,visibility] duration-200 ease-out motion-reduce:transition-none",
          open ? "visible grid-rows-[1fr] opacity-100" : "invisible grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-1 rounded-lg border bg-muted px-3 py-2 text-sm">
            {shown.changes && <p>{shown.changes}</p>}
            {shown.warning && <p className="font-medium text-destructive">{shown.warning}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
