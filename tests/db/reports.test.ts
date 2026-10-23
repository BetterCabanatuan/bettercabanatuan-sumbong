import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import {
  as,
  createDb,
  createUser,
  createVolunteer,
  type Db,
  CITY_HALL as INSIDE_WEST,
  DOWNTOWN as INSIDE_EAST,
  MANILA as OUTSIDE,
} from "./harness";

let db: Db;
let volunteerId: string;
let ids: { roads: string; poles: string; garbage: string; ceo: string; celcor: string; dpwh: string; barangay: string };
let roadsQuestions: { size: string; national: string };
let garbageProblemQuestion: string;

beforeAll(async () => {
  db = await createDb();
  volunteerId = await createVolunteer(db, "maria@example.org");

  const one = async (sql: string) => (await db.query<{ id: string }>(sql)).rows[0].id;
  ids = {
    roads: await one(`select id from categories where slug = 'roads-potholes'`),
    poles: await one(`select id from categories where slug = 'poles-wires'`),
    garbage: await one(`select id from categories where slug = 'garbage'`),
    ceo: await one(`select id from responsible_offices where short_name = 'CEO'`),
    celcor: await one(`select id from responsible_offices where short_name = 'CELCOR'`),
    dpwh: await one(`select id from responsible_offices where short_name = 'DPWH-NE2'`),
    barangay: await one(`select id from responsible_offices where short_name = 'BARANGAY'`),
  };
  roadsQuestions = {
    size: await one(`select id from category_questions where prompt_en = 'How big is it?'`),
    national: await one(`select id from category_questions where prompt_en like 'Is it on a national highway%'`),
  };
  garbageProblemQuestion = await one(
    `select q.id from category_questions q join categories c on c.id = q.category_id
     where c.slug = 'garbage' and q.required`,
  );
}, 60_000);

type Submit = {
  category?: string;
  point?: { lng: number; lat: number };
  answers?: { question_id: string; value: string }[];
  photos?: string[];
  email?: string | null;
  userId?: string | null;
  ip?: string;
  device?: string;
};

async function submit(opts: Submit = {}) {
  const id = randomUUID();
  const point = opts.point ?? INSIDE_WEST;
  const { rows } = await as(db, "service_role", null, (tx) =>
    tx.query<{ id: string; status: string; barangay_id: number | null; suggested_office_id: string; public_code: string }>(
      `select * from submit_report($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        id,
        opts.category ?? ids.roads,
        point.lng,
        point.lat,
        "Near the sari-sari store",
        "Malalim na lubak",
        JSON.stringify(opts.answers ?? [{ question_id: roadsQuestions.size, value: "large" }]),
        opts.photos ?? [`${id}/1.jpg`],
        "token-hash-" + id,
        opts.ip ?? "ip-" + randomUUID(),
        opts.device ?? "device-" + randomUUID(),
        opts.email === undefined ? "reporter@example.org" : opts.email,
        opts.userId ?? null,
      ],
    ),
  );
  return rows[0];
}

const asVolunteer = <T>(fn: Parameters<typeof as<T>>[3]) => as(db, "authenticated", volunteerId, fn);

/** Clears every evidence photo as-is, standing in for the Volunteer's blur step. */
async function clearPhotos(reportId: string) {
  return asVolunteer((tx) =>
    tx.query(
      `select set_photo_review(p.id, p.original_path, false) from report_photos p
       where p.report_id = $1 and p.kind = 'evidence'`,
      [reportId],
    ),
  );
}

async function approve(reportId: string, officeId = ids.ceo, categoryId = ids.roads) {
  await clearPhotos(reportId);
  return asVolunteer((tx) => tx.query(`select * from review_approve($1, $2, $3)`, [reportId, categoryId, officeId]));
}

async function statusOf(reportId: string) {
  const { rows } = await db.query<{ status: string; office_id: string; first_forwarded_at: Date | null; resolved_at: Date | null }>(
    `select status, office_id, first_forwarded_at, resolved_at from reports where id = $1`,
    [reportId],
  );
  return rows[0];
}

describe("submitting a Report", () => {
  it("stores a pending Report tagged with its barangay and Suggested Office", async () => {
    const report = await submit();
    expect(report.status).toBe("pending_review");
    expect(report.public_code).toMatch(/^CBN-[2-9A-HJ-NP-Z]{6}$/);
    expect(report.suggested_office_id).toBe(ids.ceo);

    const { rows: brgy } = await db.query<{ name: string }>(`select name from barangays where id = $1`, [report.barangay_id]);
    expect(brgy[0].name).toBe("Hermogenes C. Concepcion, Sr.");

    const counts = await db.query<Record<string, number>>(
      `select
         (select count(*)::int from report_answers where report_id = $1) as answers,
         (select count(*)::int from report_photos where report_id = $1) as photos,
         (select count(*)::int from report_followers where report_id = $1) as followers,
         (select count(*)::int from report_events where report_id = $1 and kind = 'submitted') as events`,
      [report.id],
    );
    expect(counts.rows[0]).toEqual({ answers: 1, photos: 1, followers: 1, events: 1 });
  });

  it("stores an optional title and exposes it with last activity in the view", async () => {
    const id = randomUUID();
    await as(db, "service_role", null, (tx) =>
      tx.query(
        `select * from submit_report(p_id => $1, p_category_id => $2, p_lng => $3, p_lat => $4, p_landmark => null,
           p_description => null, p_answers => $5, p_photo_paths => $6, p_tracking_token_hash => 'h',
           p_ip_hash => null, p_device_hash => null, p_title => '  Malalim na lubak  ')`,
        [id, ids.roads, INSIDE_WEST.lng, INSIDE_WEST.lat, JSON.stringify([{ question_id: roadsQuestions.size, value: "small" }]), [`${id}/1.jpg`]],
      ),
    );
    await approve(id);
    const { rows } = await as(db, "anon", null, (tx) =>
      tx.query<{ title: string; last_activity_at: Date; published_at: Date }>(
        `select title, last_activity_at, published_at from reports_view where id = $1`,
        [id],
      ),
    );
    expect(rows[0].title).toBe("Malalim na lubak");
    expect(rows[0].last_activity_at).toEqual(rows[0].published_at);
  });

  it("tags the barangay on the other side of the line", async () => {
    const report = await submit({ point: INSIDE_EAST });
    const { rows } = await db.query<{ name: string }>(`select name from barangays where id = $1`, [report.barangay_id]);
    expect(rows[0].name).toBe("San Roque Norte");
  });

  it("rejects a location outside Cabanatuan City", async () => {
    await expect(submit({ point: OUTSIDE })).rejects.toThrow(/outside_city/);
  });

  it("tolerates points just past the reference boundary and gives them the nearest barangay", async () => {
    const ringPoint = async (metres: number) => {
      const { rows } = await db.query<{ lng: number; lat: number }>(
        `select extensions.st_x(p) as lng, extensions.st_y(p) as lat from (
           select extensions.st_pointn(extensions.st_exteriorring(extensions.st_geometryn(
             extensions.st_buffer(geom::extensions.geography, $1)::extensions.geometry, 1)), 1) as p
           from city_boundary) s`,
        [metres],
      );
      return rows[0];
    };

    const nearEdge = await submit({ point: await ringPoint(200) });
    expect(nearEdge.barangay_id).not.toBeNull();
    await expect(submit({ point: await ringPoint(1500) })).rejects.toThrow(/outside_city/);
  });

  it("requires answers to required Category Questions and validates choices", async () => {
    await expect(submit({ answers: [] })).rejects.toThrow(/missing_answer/);
    await expect(submit({ answers: [{ question_id: roadsQuestions.size, value: "enormous" }] })).rejects.toThrow(
      /invalid_answer/,
    );
  });

  it("requires 1 to 3 photos", async () => {
    await expect(submit({ photos: [] })).rejects.toThrow(/photos_required/);
    await expect(submit({ photos: ["a", "b", "c", "d"] })).rejects.toThrow(/photos_required/);
  });

  it("rate-limits by IP and by device", async () => {
    const ip = "ip-" + randomUUID();
    for (let i = 0; i < 5; i++) await submit({ ip });
    await expect(submit({ ip })).rejects.toThrow(/rate_limited/);

    const device = "device-" + randomUUID();
    for (let i = 0; i < 5; i++) await submit({ device });
    await expect(submit({ device })).rejects.toThrow(/rate_limited/);
  });

  it("allows anonymous submissions with no Follower", async () => {
    const report = await submit({ email: null });
    const { rows } = await db.query(`select 1 from report_followers where report_id = $1`, [report.id]);
    expect(rows).toHaveLength(0);
  });

  it("cannot be called by anon or signed-in clients directly", async () => {
    const userId = await createUser(db, "someone@example.org");
    await expect(
      as(db, "anon", null, (tx) => tx.query(`select submit_report(gen_random_uuid(), null, 0, 0, null, null, null, null, 'x', null, null)`)),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(db, "authenticated", userId, (tx) =>
        tx.query(`select submit_report(gen_random_uuid(), null, 0, 0, null, null, null, null, 'x', null, null)`),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("Review", () => {
  it("keeps pending Reports private until approved", async () => {
    const report = await submit();
    const visible = () =>
      as(db, "anon", null, (tx) => tx.query(`select id from reports where id = $1`, [report.id])).then((r) => r.rows.length);

    const visibleInView = () =>
      as(db, "anon", null, (tx) =>
        tx.query<{ lat: number }>(`select lat from reports_view where id = $1`, [report.id]),
      ).then((r) => r.rows);

    expect(await visible()).toBe(0);
    expect(await visibleInView()).toHaveLength(0);
    await approve(report.id);
    expect(await visible()).toBe(1);
    expect((await visibleInView())[0].lat).toBeCloseTo(15.47082, 5);
    expect((await statusOf(report.id)).status).toBe("published");
  });

  it("only lets Volunteers approve", async () => {
    const report = await submit();
    const outsider = await createUser(db, "outsider@example.org");
    await expect(
      as(db, "authenticated", outsider, (tx) =>
        tx.query(`select review_approve($1, $2, $3)`, [report.id, ids.roads, ids.ceo]),
      ),
    ).rejects.toThrow(/Volunteer access required/);
  });

  it("logs an override when the Volunteer picks another office or category", async () => {
    const report = await submit();
    await approve(report.id, ids.dpwh);
    const { rows } = await db.query<{ kind: string }>(
      `select kind from report_events where report_id = $1 order by id`,
      [report.id],
    );
    expect(rows.map((r) => r.kind)).toEqual(["submitted", "office_changed", "status_changed"]);
    expect((await statusOf(report.id)).office_id).toBe(ids.dpwh);
  });

  it("requires a reason to reject", async () => {
    const report = await submit();
    await expect(asVolunteer((tx) => tx.query(`select review_reject($1, '  ')`, [report.id]))).rejects.toThrow(
      /reason_required/,
    );
    await asVolunteer((tx) => tx.query(`select review_reject($1, 'Not a public-space problem')`, [report.id]));
    expect((await statusOf(report.id)).status).toBe("rejected");
  });

  it("refuses to approve until every photo is cleared or hidden", async () => {
    const report = await submit({ photos: [`${randomUUID()}/1.jpg`, `${randomUUID()}/2.jpg`] });
    const approveOnly = () =>
      asVolunteer((tx) => tx.query(`select review_approve($1, $2, $3)`, [report.id, ids.roads, ids.ceo]));
    const { rows } = await db.query<{ id: string }>(
      `select id from report_photos where report_id = $1 order by sort_order`,
      [report.id],
    );

    await expect(approveOnly()).rejects.toThrow(/photos_not_cleared/);
    await asVolunteer((tx) => tx.query(`select set_photo_review($1, $2, false)`, [rows[0].id, `${report.id}/1-public.jpg`]));
    await expect(approveOnly()).rejects.toThrow(/photos_not_cleared/);
    await asVolunteer((tx) => tx.query(`select set_photo_review($1, null, true)`, [rows[1].id]));
    await approveOnly();
    expect((await statusOf(report.id)).status).toBe("published");
  });

  it("returns the photo's previous public path so the app can delete the old file", async () => {
    const report = await submit();
    const { rows } = await db.query<{ id: string }>(`select id from report_photos where report_id = $1`, [report.id]);
    const review = (path: string | null, hidden: boolean) =>
      asVolunteer((tx) =>
        tx.query<{ previous: string | null }>(`select set_photo_review($1, $2, $3) as previous`, [rows[0].id, path, hidden]),
      ).then((r) => r.rows[0].previous);

    expect(await review(`${report.id}/a.jpg`, false)).toBeNull();
    expect(await review(`${report.id}/b.jpg`, false)).toBe(`${report.id}/a.jpg`);
    expect(await review(null, true)).toBe(`${report.id}/b.jpg`);
  });

  it("keeps cleared photos private until the Report is public, and never shows hidden ones", async () => {
    const report = await submit({ photos: [`${randomUUID()}/1.jpg`, `${randomUUID()}/2.jpg`] });
    const publicPhotos = () =>
      as(db, "anon", null, (tx) => tx.query(`select id from report_photos where report_id = $1`, [report.id])).then(
        (r) => r.rows as { id: string }[],
      );
    const { rows } = await db.query<{ id: string }>(
      `select id from report_photos where report_id = $1 order by sort_order`,
      [report.id],
    );
    await asVolunteer((tx) => tx.query(`select set_photo_review($1, $2, false)`, [rows[0].id, `${report.id}/1-public.jpg`]));
    await asVolunteer((tx) => tx.query(`select set_photo_review($1, null, true)`, [rows[1].id]));

    expect(await publicPhotos()).toHaveLength(0);
    await asVolunteer((tx) => tx.query(`select review_approve($1, $2, $3)`, [report.id, ids.roads, ids.ceo]));
    expect((await publicPhotos()).map((p) => p.id)).toEqual([rows[0].id]);
  });

  it("refuses to move a Report into an inactive Category", async () => {
    const report = await submit();
    await db.query(`update categories set active = false where id = $1`, [ids.poles]);
    try {
      await expect(approve(report.id, ids.celcor, ids.poles)).rejects.toThrow(/unknown_category/);
    } finally {
      await db.query(`update categories set active = true where id = $1`, [ids.poles]);
    }
  });
});

describe("status machine", () => {
  it("refuses transitions that skip steps, even for the database owner", async () => {
    const report = await submit();
    await expect(db.query(`update reports set status = 'forwarded' where id = $1`, [report.id])).rejects.toThrow(
      /Invalid Report status transition: pending_review>forwarded/,
    );
  });

  it("refuses to publish without a Responsible Office", async () => {
    const report = await submit();
    await expect(
      db.query(`update reports set status = 'published', office_id = null where id = $1`, [report.id]),
    ).rejects.toThrow(/needs a Responsible Office/);
  });
});

describe("Digests", () => {
  it("collects waiting Reports, and sending them marks them Forwarded", async () => {
    const a = await submit({ point: INSIDE_EAST });
    const b = await submit({ point: INSIDE_EAST });
    await approve(a.id, ids.celcor, ids.roads);
    await approve(b.id, ids.celcor, ids.roads);

    const digestId = await asVolunteer((tx) =>
      tx.query<{ id: string }>(`select create_digest($1) as id`, [ids.celcor]),
    ).then((r) => r.rows[0].id);

    // A second draft has nothing new to take.
    await expect(asVolunteer((tx) => tx.query(`select create_digest($1)`, [ids.celcor]))).rejects.toThrow(
      /nothing_to_send/,
    );

    const sent = await asVolunteer((tx) =>
      tx.query<{ send_digest: string }>(`select * from send_digest($1, 'letter', 'Received at Mayor''s Office')`, [
        digestId,
      ]),
    );
    expect(sent.rows.map((r) => Object.values(r)[0]).sort()).toEqual([a.id, b.id].sort());

    const status = await statusOf(a.id);
    expect(status.status).toBe("forwarded");
    expect(status.first_forwarded_at).not.toBeNull();

    await expect(
      asVolunteer((tx) => tx.query(`select * from send_digest($1, 'letter')`, [digestId])),
    ).rejects.toThrow(/digest_already_sent/);
  });

  it("needs a barangay for per-barangay offices and only takes that barangay's Reports", async () => {
    const west = await submit({ category: ids.garbage, answers: garbageAnswers(), point: INSIDE_WEST });
    const east = await submit({ category: ids.garbage, answers: garbageAnswers(), point: INSIDE_EAST });
    await approve(west.id, ids.barangay, ids.garbage);
    await approve(east.id, ids.barangay, ids.garbage);

    await expect(asVolunteer((tx) => tx.query(`select create_digest($1)`, [ids.barangay]))).rejects.toThrow(
      /barangay_required/,
    );

    const digestId = await asVolunteer((tx) =>
      tx.query<{ id: string }>(`select create_digest($1, $2) as id`, [ids.barangay, west.barangay_id]),
    ).then((r) => r.rows[0].id);
    const { rows } = await db.query<{ report_id: string }>(`select report_id from digest_reports where digest_id = $1`, [
      digestId,
    ]);
    expect(rows.map((r) => r.report_id)).toEqual([west.id]);
  });

  it("drops Reports that changed after the draft was made", async () => {
    const keep = await submit();
    const gone = await submit();
    await approve(keep.id, ids.dpwh);
    await approve(gone.id, ids.dpwh);
    const digestId = await asVolunteer((tx) =>
      tx.query<{ id: string }>(`select create_digest($1) as id`, [ids.dpwh]),
    ).then((r) => r.rows[0].id);

    await asVolunteer((tx) => tx.query(`select review_reject($1, 'Duplicate photo of unrelated place')`, [gone.id]));
    await asVolunteer((tx) => tx.query(`select * from send_digest($1, 'email')`, [digestId]));

    expect((await statusOf(keep.id)).status).toBe("forwarded");
    expect((await statusOf(gone.id)).status).toBe("rejected");
  });

  it("starts the Forwarded clock at a backdated send time, but not before the draft's day", async () => {
    const report = await submit();
    await approve(report.id, ids.dpwh);
    const digestId = await asVolunteer((tx) =>
      tx.query<{ id: string }>(`select create_digest($1) as id`, [ids.dpwh]),
    ).then((r) => r.rows[0].id);
    await db.query(`update digests set created_at = now() - interval '3 days' where id = $1`, [digestId]);

    await expect(
      asVolunteer((tx) => tx.query(`select * from send_digest($1, 'letter', null, now() - interval '5 days')`, [digestId])),
    ).rejects.toThrow(/sent_before_draft/);

    const sentAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await asVolunteer((tx) => tx.query(`select * from send_digest($1, 'letter', null, $2)`, [digestId, sentAt]));
    expect((await statusOf(report.id)).first_forwarded_at).toEqual(sentAt);
  });
});

describe("Misroute, Resolve and Reopen", () => {
  async function forwardedReport(officeId: string) {
    const report = await submit();
    await approve(report.id, officeId);
    const digestId = await asVolunteer((tx) =>
      tx.query<{ id: string }>(`select create_digest($1) as id`, [officeId]),
    ).then((r) => r.rows[0].id);
    await asVolunteer((tx) => tx.query(`select * from send_digest($1, 'letter')`, [digestId]));
    return report;
  }

  it("returns a Misroute to Published for the right office and restarts its clock", async () => {
    const report = await forwardedReport(ids.dpwh);
    await asVolunteer((tx) =>
      tx.query(`select mark_misroute($1, $2, 'DPWH says this is a city road')`, [report.id, ids.ceo]),
    );
    const status = await statusOf(report.id);
    expect(status).toMatchObject({ status: "published", office_id: ids.ceo, first_forwarded_at: null });

    const { rows } = await db.query<{ office_id: string; previous_office_id: string }>(
      `select office_id, previous_office_id from report_events where report_id = $1 and kind = 'misrouted'`,
      [report.id],
    );
    expect(rows[0]).toEqual({ office_id: ids.ceo, previous_office_id: ids.dpwh });
  });

  it("never moves last activity backwards on a Misroute", async () => {
    const report = await forwardedReport(ids.dpwh);
    await db.query(`update reports set published_at = published_at - interval '9 days' where id = $1`, [report.id]);
    const lastActivity = () =>
      db
        .query<{ at: Date }>(`select last_activity_at as at from reports_view where id = $1`, [report.id])
        .then((r) => r.rows[0].at.getTime());
    const forwarded = await lastActivity();

    await asVolunteer((tx) => tx.query(`select mark_misroute($1, $2)`, [report.id, ids.ceo]));
    expect(await lastActivity()).toBeGreaterThanOrEqual(forwarded);
  });

  it("refuses to move a Report to the status it already has, so Followers aren't told twice", async () => {
    const report = await forwardedReport(ids.ceo);
    await asVolunteer((tx) => tx.query(`select resolve_report($1)`, [report.id]));
    await expect(asVolunteer((tx) => tx.query(`select resolve_report($1)`, [report.id]))).rejects.toThrow(
      /no_status_change/,
    );
    const { rows } = await db.query(
      `select 1 from report_events where report_id = $1 and kind = 'status_changed' and to_status = 'resolved'`,
      [report.id],
    );
    expect(rows).toHaveLength(1);
  });

  it("only lets a Volunteer reopen within 30 days of Resolved", async () => {
    const report = await forwardedReport(ids.ceo);
    await asVolunteer((tx) => tx.query(`select resolve_report($1)`, [report.id]));
    await db.query(`update reports set resolved_at = now() - interval '31 days' where id = $1`, [report.id]);
    await expect(asVolunteer((tx) => tx.query(`select reopen_report($1)`, [report.id]))).rejects.toThrow(
      /reopen_window_closed/,
    );
  });

  it("can take down a Report at any public status and stops pointing at its public photos", async () => {
    const report = await forwardedReport(ids.ceo);
    await asVolunteer((tx) => tx.query(`select review_reject($1, 'Names a private person')`, [report.id]));
    expect((await statusOf(report.id)).status).toBe("rejected");

    const { rows } = await db.query(`select 1 from report_photos where report_id = $1 and public_path is not null`, [
      report.id,
    ]);
    expect(rows).toHaveLength(0);
    const visible = await as(db, "anon", null, (tx) => tx.query(`select 1 from reports where id = $1`, [report.id]));
    expect(visible.rows).toHaveLength(0);
    await expect(
      asVolunteer((tx) => tx.query(`select review_reject($1, 'Again')`, [report.id])),
    ).rejects.toThrow(/cannot_reject/);
  });

  it("lets a Follower reopen within 30 days of Resolved, but not after", async () => {
    const report = await forwardedReport(ids.ceo);
    await asVolunteer((tx) => tx.query(`select resolve_report($1, 'Patched')`, [report.id]));
    expect((await statusOf(report.id)).status).toBe("resolved");

    await as(db, "service_role", null, (tx) => tx.query(`select reopen_by_follower($1, 'Still there')`, [report.id]));
    expect((await statusOf(report.id)).status).toBe("reopened");

    await asVolunteer((tx) => tx.query(`select resolve_report($1)`, [report.id]));
    await db.query(`update reports set resolved_at = now() - interval '31 days' where id = $1`, [report.id]);
    await expect(
      as(db, "service_role", null, (tx) => tx.query(`select reopen_by_follower($1)`, [report.id])),
    ).rejects.toThrow(/reopen_window_closed/);
  });

  it("adds the after photo only when the Report actually resolves", async () => {
    const afterPhotos = (reportId: string) =>
      db
        .query(`select 1 from report_photos where report_id = $1 and kind = 'after'`, [reportId])
        .then((r) => r.rows.length);

    const pending = await submit();
    await expect(
      asVolunteer((tx) => tx.query(`select resolve_report($1, null, 'a.jpg', 'a.jpg')`, [pending.id])),
    ).rejects.toThrow(/Invalid Report status transition/);
    expect(await afterPhotos(pending.id)).toBe(0);

    const report = await forwardedReport(ids.ceo);
    await asVolunteer((tx) => tx.query(`select resolve_report($1, 'Patched', 'b.jpg', 'b.jpg')`, [report.id]));
    expect((await statusOf(report.id)).status).toBe("resolved");
    expect(await afterPhotos(report.id)).toBe(1);
  });

  it("keeps the first Forwarded time when a reopened Report is forwarded again", async () => {
    const report = await forwardedReport(ids.celcor);
    const firstForwarded = (await statusOf(report.id)).first_forwarded_at;
    await asVolunteer((tx) => tx.query(`select resolve_report($1)`, [report.id]));
    await asVolunteer((tx) => tx.query(`select reopen_report($1)`, [report.id]));
    const digestId = await asVolunteer((tx) =>
      tx.query<{ id: string }>(`select create_digest($1) as id`, [ids.celcor]),
    ).then((r) => r.rows[0].id);
    await asVolunteer((tx) => tx.query(`select * from send_digest($1, 'letter')`, [digestId]));
    expect((await statusOf(report.id)).first_forwarded_at).toEqual(firstForwarded);
  });
});

describe("Me Too", () => {
  it("counts each device once and only on open public Reports", async () => {
    const report = await submit();
    const meToo = (device: string) =>
      as(db, "service_role", null, (tx) =>
        tx.query<{ add_me_too: number }>(`select add_me_too($1, $2)`, [report.id, device]),
      ).then((r) => r.rows[0].add_me_too);

    await expect(meToo("d1")).rejects.toThrow(/not_open/);
    await approve(report.id);
    expect(await meToo("d1")).toBe(1);
    expect(await meToo("d1")).toBe(1);
    expect(await meToo("d2")).toBe(2);
  });

  it("rate-limits Me Too by IP, but a repeat tap from the same device still succeeds", async () => {
    const report = await submit();
    await approve(report.id);
    const ip = "ip-" + randomUUID();
    const meToo = (device: string) =>
      as(db, "service_role", null, (tx) =>
        tx.query<{ add_me_too: number }>(`select add_me_too($1, $2, null, $3, 2)`, [report.id, device, ip]),
      ).then((r) => r.rows[0].add_me_too);

    expect(await meToo("ip-d1")).toBe(1);
    expect(await meToo("ip-d2")).toBe(2);
    await expect(meToo("ip-d3")).rejects.toThrow(/rate_limited/);
    expect(await meToo("ip-d1")).toBe(2);
  });

  it("finds nearby open Reports for the duplicate check", async () => {
    const report = await submit({ point: { lng: 120.9601, lat: 15.4801 } });
    await approve(report.id);
    const { rows } = await as(db, "anon", null, (tx) =>
      tx.query<{ id: string; distance_m: number }>(`select * from nearby_reports($1, $2, 100, $3)`, [
        120.9602,
        15.4802,
        ids.roads,
      ]),
    );
    expect(rows.map((r) => r.id)).toContain(report.id);
    expect(rows[0].distance_m).toBeLessThan(100);
  });
});

describe("privacy", () => {
  it("never exposes secrets or Follower contacts to anon", async () => {
    const report = await submit();
    await approve(report.id);
    await as(db, "anon", null, async (tx) => {
      expect((await tx.query(`select * from report_secrets`)).rows).toHaveLength(0);
      expect((await tx.query(`select * from report_followers`)).rows).toHaveLength(0);
      expect((await tx.query(`select * from me_toos`)).rows).toHaveLength(0);
      expect((await tx.query(`select * from report_events`)).rows).toHaveLength(0);
    });
  });

  it("lets Volunteers delete public photo files, and nobody else", async () => {
    const name = `${randomUUID()}/photo.jpg`;
    await db.query(`insert into storage.objects (bucket_id, name) values ('report-public', $1), ('report-originals', $1)`, [
      name,
    ]);
    const resident = await createUser(db, `resident-${randomUUID()}@example.org`);
    const remove = (userId: string, bucket: string) =>
      as(db, "authenticated", userId, (tx) =>
        tx.query(`delete from storage.objects where bucket_id = $1 and name = $2`, [bucket, name]),
      ).then((r) => r.affectedRows);

    expect(await remove(resident, "report-public")).toBe(0);
    expect(await remove(volunteerId, "report-originals")).toBe(0);
    expect(await remove(volunteerId, "report-public")).toBe(1);
  });

  it("only lets the service role look up users by email", async () => {
    const id = await createUser(db, "Existing@Example.org");
    const { rows } = await as(db, "service_role", null, (tx) =>
      tx.query<{ id: string }>(`select find_user_id_by_email(' existing@example.org ') as id`),
    );
    expect(rows[0].id).toBe(id);
    await expect(
      as(db, "authenticated", volunteerId, (tx) => tx.query(`select find_user_id_by_email('x@example.org')`)),
    ).rejects.toThrow(/permission denied/);
  });

  it("lets an account holder see their own pending Report", async () => {
    const userId = await createUser(db, "juan@example.org");
    const report = await submit({ userId, email: "juan@example.org" });
    const { rows } = await as(db, "authenticated", userId, (tx) =>
      tx.query(`select id from reports where id = $1`, [report.id]),
    );
    expect(rows).toHaveLength(1);
  });

  it("purges Follower contacts 90 days after final Resolved", async () => {
    const report = await submit();
    await approve(report.id);
    await asVolunteer((tx) => tx.query(`select resolve_report($1)`, [report.id]));
    await db.query(`update reports set resolved_at = now() - interval '91 days' where id = $1`, [report.id]);
    await db.query(`update report_secrets set created_at = now() - interval '31 days' where report_id = $1`, [report.id]);

    await db.query(`select purge_expired_personal_data()`);

    const { rows } = await db.query(`select 1 from report_followers where report_id = $1`, [report.id]);
    expect(rows).toHaveLength(0);
    const secrets = await db.query<{ ip_hash: string | null }>(`select ip_hash from report_secrets where report_id = $1`, [
      report.id,
    ]);
    expect(secrets.rows[0].ip_hash).toBeNull();
  });

  it("purges Me Too IP hashes after 30 days but keeps the Me Too", async () => {
    const report = await submit();
    await approve(report.id);
    await as(db, "service_role", null, (tx) =>
      tx.query(`select add_me_too($1, 'purge-device', null, 'purge-ip')`, [report.id]),
    );
    await db.query(`update me_toos set created_at = now() - interval '31 days' where report_id = $1`, [report.id]);

    await db.query(`select purge_expired_personal_data()`);

    const { rows } = await db.query<{ ip_hash: string | null }>(`select ip_hash from me_toos where report_id = $1`, [
      report.id,
    ]);
    expect(rows).toEqual([{ ip_hash: null }]);
  });
});

function garbageAnswers() {
  return [{ question_id: garbageProblemQuestion, value: "uncollected" }];
}
