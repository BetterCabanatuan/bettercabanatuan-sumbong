"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { PERMISSION_ACTIONS, PERMISSION_AREAS } from "@/lib/permissions";
import type { Permission, PermissionArea, PermissionInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The role editor's grid of areas × actions. A dash marks an action the area doesn't have.
 * Any action in an area turns on its View (you can't edit what you can't open), and
 * turning View off clears the row. Selected keys submit as `permissions` form values.
 */
export function PermissionMatrix({
  permissions,
  defaultSelected,
  disabled = false,
}: {
  permissions: PermissionInfo[];
  defaultSelected: Permission[];
  disabled?: boolean;
}) {
  const [selected, setSelected] = useState(() => new Set(defaultSelected));
  const cell = new Map(permissions.map((p) => [`${p.resource}.${p.action}`, p]));
  const areas = PERMISSION_AREAS.filter((area) => permissions.some((p) => p.resource === area.key));
  const actions = PERMISSION_ACTIONS.filter((action) => permissions.some((p) => p.action === action.key));
  const inArea = (area: PermissionArea) => permissions.filter((p) => p.resource === area).map((p) => p.key);
  const inAction = (action: string) => permissions.filter((p) => p.action === action).map((p) => p.key);

  function update(keys: Permission[], on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const key of keys) {
        const area = key.split(".")[0] as PermissionArea;
        if (on) {
          next.add(key);
          next.add(`${area}.view` as Permission);
        } else if (key.endsWith(".view")) {
          for (const k of inArea(area)) next.delete(k);
        } else {
          next.delete(key);
        }
      }
      return next;
    });
  }

  const all = (keys: Permission[]) => keys.length > 0 && keys.every((k) => selected.has(k));

  return (
    <div className="flex flex-col gap-3">
      {[...selected].map((key) => (
        <input key={key} type="hidden" name="permissions" value={key} />
      ))}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b bg-muted">
              <th scope="col" className="sticky left-0 z-10 bg-muted px-3 py-2 text-left font-medium">
                Area
              </th>
              {actions.map((action) => (
                <th key={action.key} scope="col" className="px-2 py-2 font-medium">
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
          <tbody>
            {areas.map((area) => {
              const row = inArea(area.key);
              return (
                <tr key={area.key} className="border-b last:border-0">
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
                  {actions.map((action) => {
                    const permission = cell.get(`${area.key}.${action.key}`);
                    return (
                      <td key={action.key} className="px-2 py-2.5 text-center">
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
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className={cn("text-sm text-muted-foreground", disabled && "sr-only")}>
        <span className="tabular-nums">
          {selected.size} of {permissions.length}
        </span>{" "}
        permissions. Checking any action also allows View; unchecking View clears the row.
      </p>
      <details className="rounded-lg border px-3 py-2 text-sm">
        <summary className="cursor-pointer font-medium">What each permission allows</summary>
        <dl className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-[minmax(10rem,auto)_1fr]">
          {areas.flatMap((area) =>
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
    </div>
  );
}
