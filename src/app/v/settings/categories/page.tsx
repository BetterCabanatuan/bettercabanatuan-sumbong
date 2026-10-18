import { Plus } from "lucide-react";
import Link from "next/link";
import { CategoryIcon } from "@/components/category-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { byId, getCategories, getOffices } from "@/lib/data";

export default async function CategoriesPage() {
  const [categories, offices] = await Promise.all([getCategories({ includeInactive: true }), getOffices({ includeInactive: true })]);
  const officesById = byId(offices);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-navy">Categories</h1>
          <p className="text-muted-foreground">What residents can report, and which office each goes to by default.</p>
        </div>
        <Button nativeButton={false} render={<Link href="/v/settings/categories/new" />}>
          <Plus data-icon="inline-start" />
          New Category
        </Button>
      </div>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Category</TableHead>
              <TableHead>Default office</TableHead>
              <TableHead>Questions</TableHead>
              <TableHead className="pr-4 text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="pl-4">
                  <Link href={`/v/settings/categories/${c.id}`} className="flex items-center gap-2 font-medium text-primary underline">
                    <CategoryIcon icon={c.icon} className="size-4" />
                    {c.name_en}
                  </Link>
                  <span className="text-muted-foreground">{c.name_fil}</span>
                </TableCell>
                <TableCell>{c.default_office_id ? officesById.get(c.default_office_id)?.short_name : "None"}</TableCell>
                <TableCell className="tabular-nums">{c.questions.length}</TableCell>
                <TableCell className="pr-4 text-right">
                  <Badge variant={c.active ? "secondary" : "outline"}>{c.active ? "Active" : "Inactive"}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
