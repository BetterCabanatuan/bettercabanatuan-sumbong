"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { destinationsFor, type ShortcutState, stepShortcuts } from "@/lib/shortcuts";
import type { Permission } from "@/lib/types";

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border bg-muted px-1.5 py-0.5 font-sans text-xs text-muted-foreground">{children}</kbd>;
}

/**
 * Console keyboard shortcuts: `G` then a letter to go to a page, `?` for help, Cmd/Ctrl+K for the palette.
 * Only pages the role may open are offered. Nothing here submits or changes anything.
 */
export function Shortcuts({ permissions }: { permissions: Permission[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const destinations = useMemo(() => destinationsFor(permissions), [permissions]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Mac shows ⌘, others Ctrl. The server and first paint say Ctrl; the browser then says which.
  const mac = useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => false,
  );
  const state = useRef<ShortcutState>({ armedAt: null });
  const open = useRef(false);

  useEffect(() => {
    open.current = helpOpen || paletteOpen;
  }, [helpOpen, paletteOpen]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const result = stepShortcuts(state.current, event, Date.now(), destinations);
      state.current = result.state;
      const { action } = result;
      if (!action) return;
      // The palette toggles from anywhere; everything else waits until the open dialog is closed.
      if (action.type === "palette") {
        event.preventDefault();
        setHelpOpen(false);
        setPaletteOpen((o) => !o);
      } else if (!open.current) {
        event.preventDefault();
        if (action.type === "help") setHelpOpen(true);
        else router.push(action.href);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [destinations, router]);

  const work = destinations.filter((d) => d.group === "Work");
  const settings = destinations.filter((d) => d.group === "Settings");

  function go(href: string) {
    setPaletteOpen(false);
    router.push(href);
  }

  return (
    <>
      <Button variant="outline" size="sm" className="ml-auto text-muted-foreground" onClick={() => setPaletteOpen(true)}>
        <Search data-icon="inline-start" />
        <span className="hidden sm:inline">Jump to</span>
        <span className="sr-only sm:hidden">Jump to a page</span>
        <kbd className="ml-1 hidden rounded border bg-muted px-1 font-sans text-xs md:inline">{mac ? "⌘K" : "Ctrl K"}</kbd>
      </Button>

      <CommandDialog
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        title="Jump to a page"
        description="Type to find a page, then press Enter."
      >
        <Command>
          <CommandInput placeholder="Jump to…" />
          <CommandList>
            <CommandEmpty>No page matches.</CommandEmpty>
            <CommandGroup heading="Work">
              {work.map((d) => (
                <CommandItem key={d.href} value={d.label} onSelect={() => go(d.href)}>
                  {d.label}
                  <CommandShortcut>G {d.chord.toUpperCase()}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
            {settings.length > 0 && (
              <CommandGroup heading="Settings">
                {settings.map((d) => (
                  <CommandItem key={d.href} value={`Settings ${d.label}`} onSelect={() => go(d.href)}>
                    {d.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandGroup heading="Public">
              <CommandItem value="Public board" onSelect={() => go("/")}>
                Public board
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>They work anywhere in the console except while you are typing in a field.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 text-sm">
            <ShortcutGroup title="Go to">
              {work.map((d) => (
                <Row key={d.href} label={d.label}>
                  <Kbd>G</Kbd> then <Kbd>{d.chord.toUpperCase()}</Kbd>
                </Row>
              ))}
            </ShortcutGroup>
            <ShortcutGroup title="Anywhere">
              <Row label="Jump to any page">
                <Kbd>{mac ? "⌘" : "Ctrl"}</Kbd> <Kbd>K</Kbd>
              </Row>
              <Row label="Show this help">
                <Kbd>?</Kbd>
              </Row>
              <Row label="Close a dialog">
                <Kbd>Esc</Kbd>
              </Row>
            </ShortcutGroup>
            {pathname === "/v/reports" && (
              <ShortcutGroup title="On this page">
                <Row label="Clear the selected Reports">
                  <Kbd>Esc</Kbd>
                </Row>
              </ShortcutGroup>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ShortcutGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      <ul className="flex flex-col divide-y rounded-lg border">{children}</ul>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2">
      <span>{label}</span>
      <span className="flex items-center gap-1 text-muted-foreground">{children}</span>
    </li>
  );
}
