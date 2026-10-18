import { Printer } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { discardDigest, sendDigest } from "@/app/v/actions";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { ActionForm, SubmitButton } from "@/components/volunteer/action-form";
import { ProofUpload } from "@/components/volunteer/proof-upload";
import { RemoveFromDigest } from "@/components/volunteer/remove-from-digest";
import { getDigestBundle } from "@/lib/digests";
import { PROOFS_BUCKET } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

const CHANNELS = [
  ["letter", "Printed letter (hand-delivered / received stamp)"],
  ["email", "Email"],
  ["text_line", "Text line"],
  ["in_person", "In person"],
  ["other", "Other"],
] as const;

function manilaNow() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

export default async function DigestPage({ params }: PageProps<"/v/digests/[id]">) {
  const { id } = await params;
  const bundle = await getDigestBundle(id);
  if (!bundle) notFound();
  const { digest, reports, office, barangay, categories, barangays } = bundle;
  const sent = Boolean(digest.sent_at);

  let proofUrl: string | null = null;
  if (digest.proof_photo_path) {
    const { data } = await (await createClient()).storage.from(PROOFS_BUCKET).createSignedUrl(digest.proof_photo_path, 60 * 60);
    proofUrl = data?.signedUrl ?? null;
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-navy">
          {sent ? "Sent" : "Draft"} Digest · {office.short_name}
          {barangay && ` · Brgy. ${barangay.name}`}
        </h1>
        <Button nativeButton={false} render={<Link href={`/v/digests/${digest.id}/letter`} />} className="ml-auto">
          <Printer data-icon="inline-start" />
          Printable letter
        </Button>
      </div>
      <p className="text-muted-foreground">
        Channel: <span className="text-foreground">{office.channel}</span>
        {office.email && ` · ${office.email}`}
        {office.phone && ` · ${office.phone}`}
      </p>

      <Card className="pb-0">
        <CardHeader>
          <CardTitle>{reports.length} Reports</CardTitle>
        </CardHeader>
        <Table>
          <TableBody>
            {reports.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="pl-4 font-mono">
                  <Link href={`/v/reports/${r.id}`} className="text-primary underline">
                    {r.public_code}
                  </Link>
                </TableCell>
                <TableCell>
                  <StatusBadge status={r.status} />
                </TableCell>
                <TableCell className="max-w-72 truncate">{r.title ?? categories.find((c) => c.id === r.category_id)?.name_en}</TableCell>
                <TableCell className="text-muted-foreground">{barangays.find((b) => b.id === r.barangay_id)?.name}</TableCell>
                <TableCell className="pr-4 text-right">{!sent && <RemoveFromDigest digestId={digest.id} reportId={r.id} />}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {sent ? (
        <Card>
          <CardHeader>
            <CardTitle>Send log</CardTitle>
            <CardDescription>
              Sent {new Date(digest.sent_at!).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} by{" "}
              {bundle.senderName ?? "a Volunteer"} via {digest.channel?.replace("_", " ")}
              {digest.channel_detail && ` (${digest.channel_detail})`}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {proofUrl ? (
              <Button variant="outline" nativeButton={false} render={<a href={proofUrl} target="_blank" rel="noreferrer" />}>
                View Proof of Receipt
              </Button>
            ) : (
              <ProofUpload digestId={digest.id} />
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <Card>
            <ActionForm
              action={sendDigest.bind(null, digest.id)}
              className="contents"
              success="Logged. The Reports are now Forwarded and Followers were notified."
            >
              <CardHeader>
                <CardTitle>Log the send</CardTitle>
                <CardDescription>Only after it actually went out. Its Reports become Forwarded and Followers get an email.</CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="channel">How was it sent?</FieldLabel>
                    <NativeSelect id="channel" name="channel" defaultValue="letter">
                      {CHANNELS.map(([value, label]) => (
                        <NativeSelectOption key={value} value={value}>
                          {label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="channel_detail">Details</FieldLabel>
                    <Input id="channel_detail" name="channel_detail" maxLength={300} />
                    <FieldDescription>e.g. “Received by Mayor’s Office receiving clerk”, an email subject, a reference number.</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="sent_at">Sent at (Manila time)</FieldLabel>
                    <Input id="sent_at" name="sent_at" type="datetime-local" defaultValue={manilaNow()} max={manilaNow()} />
                  </Field>
                </FieldGroup>
              </CardContent>
              <CardFooter>
                <SubmitButton>Log send</SubmitButton>
              </CardFooter>
            </ActionForm>
          </Card>
          <Card>
            <ActionForm action={discardDigest.bind(null, digest.id)} className="contents">
              <CardHeader>
                <CardTitle>Discard draft</CardTitle>
                <CardDescription>Its Reports go back to waiting for the next Digest.</CardDescription>
              </CardHeader>
              <CardFooter>
                <SubmitButton variant="outline">Discard</SubmitButton>
              </CardFooter>
            </ActionForm>
          </Card>
        </div>
      )}
    </>
  );
}
