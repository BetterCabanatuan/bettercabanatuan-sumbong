import type { Metadata } from "next";
import Link from "next/link";
import { FlagStripe } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { VolunteerSidebar } from "@/components/volunteer/volunteer-sidebar";
import { requireVolunteer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Volunteers", robots: { index: false } };

export default async function VolunteerLayout({ children }: LayoutProps<"/v">) {
  const volunteer = await requireVolunteer();
  const supabase = await createClient();
  const { count: pending } = await supabase
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending_review");

  return (
    <SidebarProvider lang="en">
      <VolunteerSidebar
        displayName={volunteer.display_name}
        roleName={volunteer.role_name}
        permissions={volunteer.permissions}
        pending={pending ?? 0}
      />
      <SidebarInset>
        <div className="no-print sticky top-0 z-20 bg-background/95 backdrop-blur">
          <FlagStripe />
          <header className="flex h-12 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
            <span className="text-sm font-medium">BetterCabanatuan Volunteers</span>
            <Button variant="ghost" size="sm" className="ml-auto" nativeButton={false} render={<Link href="/" />}>
              Public board
            </Button>
          </header>
        </div>
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
