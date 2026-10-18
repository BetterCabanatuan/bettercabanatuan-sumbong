import { ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { byId, getBarangays, getCategories, getReports } from "@/lib/data";

export default async function ReviewQueuePage({ searchParams }: PageProps<"/v/review">) {
  const params = await searchParams;
  const [reports, categories, barangays] = await Promise.all([
    getReports({ statuses: ["pending_review"] }),
    getCategories({ includeInactive: true }),
    getBarangays(),
  ]);
  const categoriesById = byId(categories);
  const barangaysById = byId(barangays);
  const queue = [...reports].reverse(); // oldest first

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-navy">Review queue</h1>
        <p className="text-muted-foreground">
          Oldest first. Check the location and Category, pixelate faces and plate numbers, confirm the Responsible Office.
        </p>
      </div>
      {params.approved && (
        <Alert>
          <AlertDescription>Approved and published.</AlertDescription>
        </Alert>
      )}
      {params.rejected && (
        <Alert>
          <AlertDescription>Rejected.</AlertDescription>
        </Alert>
      )}
      {queue.length === 0 ? (
        <Empty className="flex-none border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ClipboardCheck />
            </EmptyMedia>
            <EmptyTitle>Nothing to review</EmptyTitle>
            <EmptyDescription>Salamat! New Reports will show up here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Code</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Barangay</TableHead>
                <TableHead className="pr-4 text-right">Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queue.map((report) => (
                <TableRow key={report.id}>
                  <TableCell className="pl-4 font-mono">
                    <Link href={`/v/review/${report.id}`} className="text-primary underline">
                      {report.public_code}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-64 truncate">{report.title ?? "—"}</TableCell>
                  <TableCell>{categoriesById.get(report.category_id)?.name_en}</TableCell>
                  <TableCell>{report.barangay_id ? barangaysById.get(report.barangay_id)?.name : "Not tagged"}</TableCell>
                  <TableCell className="pr-4 text-right text-muted-foreground">
                    {new Date(report.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
