import type { Metadata } from "next";
import Link from "next/link";
import { FlagStripe } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ConsoleBreadcrumb } from "@/components/volunteer/console-breadcrumb";
import { Shortcuts } from "@/components/volunteer/shortcuts";
import { VolunteerSidebar } from "@/components/volunteer/volunteer-sidebar";
import { requireVolunteer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Volunteers", robots: { index: false } };

export default async function VolunteerLayout({ children }: LayoutProps<"/v">) {
  const volunteer = await requireVolunteer();
  const supabase = await createClient();
  const [{ count: pending }, { data: waiting }] = await Promise.all([
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
    // Offices with Published or Reopened Reports waiting for a Digest, counted here from up to 1000 rows (no migration for this).
    volunteer.permissions.includes("digests.view")
      ? supabase.from("reports").select("office_id").in("status", ["published", "reopened"]).limit(1000)
      : Promise.resolve({ data: null }),
  ]);
  const digestsWaiting = new Set((waiting ?? []).map((row) => row.office_id).filter(Boolean)).size;

  return (
    <SidebarProvider lang="en">
      <VolunteerSidebar
        displayName={volunteer.display_name}
        roleName={volunteer.role_name}
        permissions={volunteer.permissions}
        pending={pending ?? 0}
        digestsWaiting={digestsWaiting}
      />
      <SidebarInset>
        <div className="no-print sticky top-0 z-20 bg-background/95 backdrop-blur">
          <FlagStripe />
          <header className="flex h-12 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
            <ConsoleBreadcrumb />
            <Shortcuts permissions={volunteer.permissions} />
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/" />}>
              Public board
            </Button>
          </header>
        </div>
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
