"use client";

import { Copy, X } from "lucide-react";
import { createContext, type ReactNode, use, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { isTypingTarget } from "@/lib/shortcuts";

interface Selection {
  /** Selected Report id -> its public code. */
  selected: ReadonlyMap<string, string>;
  toggle: (id: string, code: string) => void;
  setMany: (rows: { id: string; code: string }[], on: boolean) => void;
  clear: () => void;
}

const SelectionContext = createContext<Selection | null>(null);

function useSelection() {
  const selection = use(SelectionContext);
  if (!selection) throw new Error("Selection components must sit inside <ReportSelection>.");
  return selection;
}

/** Keeps which Reports are ticked in the Reports table, and shows the bar that acts on them. */
export function ReportSelection({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<ReadonlyMap<string, string>>(new Map());
  const toggle = useCallback((id: string, code: string) => {
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(id)) next.delete(id);
      else next.set(id, code);
      return next;
    });
  }, []);
  const setMany = useCallback((rows: { id: string; code: string }[], on: boolean) => {
    setSelected((current) => {
      const next = new Map(current);
      for (const row of rows) {
        if (on) next.set(row.id, row.code);
        else next.delete(row.id);
      }
      return next;
    });
  }, []);
  const clear = useCallback(() => setSelected(new Map()), []);
  const value = useMemo(() => ({ selected, toggle, setMany, clear }), [selected, toggle, setMany, clear]);

  return (
    <SelectionContext value={value}>
      {children}
      <SelectionBar />
    </SelectionContext>
  );
}

export function RowCheckbox({ id, code, label }: { id: string; code: string; label: string }) {
  const { selected, toggle } = useSelection();
  return <Checkbox aria-label={label} checked={selected.has(id)} onCheckedChange={() => toggle(id, code)} />;
}

export function SelectAllCheckbox({ rows }: { rows: { id: string; code: string }[] }) {
  const { selected, setMany } = useSelection();
  const count = rows.filter((row) => selected.has(row.id)).length;
  const all = rows.length > 0 && count === rows.length;
  return (
    <Checkbox
      aria-label={`Select all ${rows.length} shown`}
      checked={all}
      indeterminate={count > 0 && !all}
      onCheckedChange={(on) => setMany(rows, on)}
    />
  );
}

function SelectionBar() {
  const { selected, clear } = useSelection();
  const count = selected.size;

  // Esc clears the selection, unless the key belongs to a field or a dialog that has focus.
  useEffect(() => {
    if (count === 0) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented || isTypingTarget(event.target)) return;
      if (document.querySelector('[role="dialog"]')) return;
      clear();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [count, clear]);

  if (count === 0) return null;

  async function copyCodes() {
    try {
      await navigator.clipboard.writeText([...selected.values()].join("\n"));
      toast.success(`Copied ${count} ${count === 1 ? "code" : "codes"}`);
    } catch {
      toast.error("Couldn’t copy. Your browser blocked clipboard access.");
    }
  }

  return (
    <div
      role="region"
      aria-label="Selected Reports"
      className="no-print fixed inset-x-4 bottom-4 z-30 mx-auto flex w-fit max-w-full items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm shadow-lg motion-safe:animate-rise-in"
    >
      <span className="px-1 font-medium tabular-nums" aria-live="polite">
        {count} selected
      </span>
      <Button size="sm" variant="outline" onClick={copyCodes}>
        <Copy data-icon="inline-start" />
        Copy codes
      </Button>
      <Button size="sm" variant="ghost" onClick={clear}>
        <X data-icon="inline-start" />
        Clear
        <kbd className="ml-1 hidden rounded border px-1 font-sans text-xs text-muted-foreground md:inline">Esc</kbd>
      </Button>
    </div>
  );
}
