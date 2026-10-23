import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { getDigestBundle } from "@/lib/digests";
import { env } from "@/lib/env";
import { publicPhotoUrl } from "@/lib/storage";
import { PrintButton } from "./print-button";

function letterDate(sentAt: string | null) {
  return new Date(sentAt ?? Date.now()).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", dateStyle: "long" });
}

/** The Digest as a letter to the Responsible Office, following its Citizen's Charter channel. */
export default async function DigestLetterPage({ params }: PageProps<"/v/digests/[id]/letter">) {
  await requirePermission("digests.print");
  const { id } = await params;
  const bundle = await getDigestBundle(id);
  if (!bundle) notFound();
  const { digest, reports, photos, office, barangay, categories, barangays, senderName } = bundle;

  const date = letterDate(digest.sent_at);
  const addressee = (office.letter_addressee ?? office.name_en).replace("{barangay}", barangay?.name ?? "");
  const categoryNames = [...new Set(reports.map((r) => categories.find((c) => c.id === r.category_id)?.name_en))]
    .filter(Boolean)
    .join(", ");

  return (
    <article className="mx-auto max-w-[800px] space-y-5 bg-white p-2 text-[15px] leading-relaxed text-black print:p-0">
      <div className="no-print flex justify-end">
        <PrintButton />
      </div>

      <header className="border-b border-black pb-3">
        <p className="text-lg font-bold">BetterCabanatuan</p>
        <p className="text-sm">
          A volunteer civic initiative for Cabanatuan City · bettercabanatuan.org · Not affiliated with the City Government
        </p>
      </header>

      <p>{date}</p>
      <p className="whitespace-pre-line font-medium">{addressee}</p>
      {office.letter_attention && <p>Attention: {office.letter_attention}</p>}

      <p>
        <strong>Subject:</strong> Request for action on {reports.length} resident report{reports.length === 1 ? "" : "s"}
        {categoryNames && ` (${categoryNames})`}
        {barangay && ` in Barangay ${barangay.name}`}
      </p>

      <p>Dear Sir/Madam:</p>
      <p>
        Residents of Cabanatuan City submitted the following reports through the BetterCabanatuan Sumbong tool. Our
        volunteers reviewed each one and, based on its location and type, believe it falls under your office. We
        respectfully request inspection and appropriate action. Each report has a public page with photos and a map,
        where its status is updated as work progresses.
      </p>

      <ol className="space-y-4">
        {reports.map((r, i) => {
          const category = categories.find((c) => c.id === r.category_id);
          const brgy = barangays.find((b) => b.id === r.barangay_id);
          const photo = photos.find((p) => p.report_id === r.id && p.kind === "evidence" && p.public_path && !p.hidden);
          return (
            <li key={r.id} className="flex break-inside-avoid gap-3 border border-gray-400 p-3">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="font-bold">
                  {i + 1}. {category?.name_en} · {r.public_code}
                </p>
                <p>
                  Location: {brgy ? `Brgy. ${brgy.name}` : "Cabanatuan City"}
                  {r.landmark && `, ${r.landmark}`}
                </p>
                <p>
                  Coordinates: {r.lat.toFixed(6)}, {r.lng.toFixed(6)} (google.com/maps?q={r.lat.toFixed(6)},
                  {r.lng.toFixed(6)})
                </p>
                <p>
                  Reported: {new Date(r.created_at).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })}
                  {r.me_too_count > 0 && ` · ${r.me_too_count} other resident${r.me_too_count === 1 ? "" : "s"} confirmed`}
                  {r.status === "reopened" && " · Previously marked fixed; residents say it is not"}
                </p>
                {r.description && <p className="italic">“{r.description}”</p>}
                <p className="text-sm">Details & photos: {`${env.siteUrl}/r/${r.public_code}`}</p>
              </div>
              {photo?.public_path && (
                // eslint-disable-next-line @next/next/no-img-element -- printed letter
                <img src={publicPhotoUrl(photo.public_path)} alt="" className="size-28 shrink-0 object-cover" />
              )}
            </li>
          );
        })}
      </ol>

      <p>
        We would be grateful for any update on these items, which we will reflect on each report&apos;s public page. For
        questions, please reply to sumbong@bettercabanatuan.org.
      </p>
      <p>Thank you for your service to the people of Cabanatuan.</p>

      <div className="pt-8">
        <p>Respectfully,</p>
        <p className="pt-10 font-medium">{senderName ?? "________________________"}</p>
        <p>Volunteer, BetterCabanatuan</p>
      </div>

      <footer className="border-t border-gray-400 pt-2 text-xs">
        Received by: ________________________ Date/time: ______________ (please stamp or sign)
      </footer>
    </article>
  );
}
