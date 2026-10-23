// What a resident, a Volunteer and a Coordinator can each do, enforced by the database
// (functions and row-level security), independent of the app's own checks.
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { as, CITY_HALL, createDb, createUser, createVolunteer, type Db } from "./harness";

let db: Db;
let resident: string;
let volunteer: string;
let coordinator: string;
let deactivated: string;
let ids: { roads: string; ceo: string; roadsSize: string; volunteerRole: string; coordinatorRole: string };

/** Runs one statement as a signed-in user and returns its rows and affected-row count. */
async function run(userId: string, sql: string, params: unknown[] = []) {
  const result = await as(db, "authenticated", userId, (tx) => tx.query<Record<string, unknown>>(sql, params));
  return { rows: result.rows, affected: result.affectedRows ?? 0 };
}

async function submit(userId: string | null = null) {
  const id = randomUUID();
  await as(db, "service_role", null, (tx) =>
    tx.query(`select submit_report($1, $2, $3, $4, '', '', $5, $6, 'hash', $7, $8, $9, $10)`, [
      id,
      ids.roads,
      CITY_HALL.lng,
      CITY_HALL.lat,
      JSON.stringify([{ question_id: ids.roadsSize, value: "large" }]),
      [`${id}/1.jpg`],
      "ip-" + id,
      "device-" + id,
      userId ? null : "reporter@example.org",
      userId,
    ]),
  );
  return id;
}

beforeAll(async () => {
  db = await createDb();
  resident = await createUser(db, "resident@example.org");
  volunteer = await createVolunteer(db, "volunteer@example.org");
  coordinator = await createVolunteer(db, "coordinator@example.org", "Coordinator");
  deactivated = await createVolunteer(db, "former@example.org");
  await db.query(`update volunteers set active = false where user_id = $1`, [deactivated]);

  const one = async (sql: string) => (await db.query<{ id: string }>(sql)).rows[0].id;
  ids = {
    roads: await one(`select id from categories where slug = 'roads-potholes'`),
    ceo: await one(`select id from responsible_offices where short_name = 'CEO'`),
    roadsSize: await one(`select id from category_questions where prompt_en = 'How big is it?'`),
    volunteerRole: await one(`select id from roles where name = 'Volunteer'`),
    coordinatorRole: await one(`select id from roles where name = 'Coordinator'`),
  };
}, 60_000);

describe("a signed-in resident", () => {
  it("cannot run Volunteer operations", async () => {
    const report = await submit();
    for (const sql of [
      `select review_reject($1, 'x')`,
      `select resolve_report($1)`,
      `select reopen_report($1)`,
    ]) {
      await expect(run(resident, sql, [report])).rejects.toThrow(/Volunteer access required/);
    }
    await expect(run(resident, `select create_digest($1)`, [ids.ceo])).rejects.toThrow(/Volunteer access required/);
  });

  it("cannot call the Reporter operations directly; only the server can, after Turnstile and rate limits", async () => {
    const report = await submit();
    await expect(run(resident, `select add_me_too($1, 'device')`, [report])).rejects.toThrow(/permission denied/);
    await expect(run(resident, `select reopen_by_follower($1)`, [report])).rejects.toThrow(/permission denied/);
  });

  it("sees their own pending Report but nobody else's", async () => {
    const theirs = await submit();
    const mine = await submit(resident);
    const seen = (await run(resident, `select id from reports`)).rows.map((r) => r.id);
    expect(seen).toContain(mine);
    expect(seen).not.toContain(theirs);
  });

  it("cannot change Reports, reference data or the Volunteer roster", async () => {
    expect((await run(resident, `update reports set status = 'published'`)).affected).toBe(0);
    expect((await run(resident, `update categories set name_en = 'x'`)).affected).toBe(0);
    expect((await run(resident, `update responsible_offices set name_en = 'x'`)).affected).toBe(0);
    await expect(
      run(resident, `insert into volunteers (user_id, display_name, role_id) values ($1, 'me', $2)`, [
        resident,
        ids.coordinatorRole,
      ]),
    ).rejects.toThrow(/row-level security/);
    await expect(run(resident, `select set_user_access($1, $2)`, [resident, ids.coordinatorRole])).rejects.toThrow(
      /Volunteer access required/,
    );
  });

  it("cannot read history, Digests, secrets or other people's Follower records", async () => {
    for (const table of ["report_events", "digests", "digest_reports", "report_secrets", "me_toos"]) {
      expect((await run(resident, `select * from ${table}`)).rows, table).toHaveLength(0);
    }
    const others = await run(resident, `select * from report_followers where user_id is distinct from $1`, [resident]);
    expect(others.rows).toHaveLength(0);
  });

  it("cannot upload photos", async () => {
    await expect(
      run(resident, `insert into storage.objects (bucket_id, name) values ('report-public', 'x.jpg')`),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("a Volunteer", () => {
  it("can Review, build Digests and upload photos", async () => {
    const report = await submit();
    await run(volunteer, `select set_photo_review(p.id, p.original_path, false) from report_photos p where report_id = $1`, [
      report,
    ]);
    await run(volunteer, `select review_approve($1, $2, $3)`, [report, ids.roads, ids.ceo]);
    await run(volunteer, `select create_digest($1)`, [ids.ceo]);
    await run(volunteer, `insert into storage.objects (bucket_id, name) values ('report-public', $1)`, [`${report}/1.jpg`]);
  });

  it("changes Reports only through the database functions", async () => {
    expect((await run(volunteer, `update reports set status = 'resolved'`)).affected).toBe(0);
  });

  it("cannot manage Categories, Category Questions or Responsible Offices", async () => {
    expect((await run(volunteer, `update categories set name_en = 'x'`)).affected).toBe(0);
    expect((await run(volunteer, `update category_questions set prompt_en = 'x'`)).affected).toBe(0);
    expect((await run(volunteer, `update responsible_offices set name_en = 'x'`)).affected).toBe(0);
    await expect(
      run(volunteer, `insert into categories (slug, name_en, name_fil) values ('x', 'x', 'x')`),
    ).rejects.toThrow(/row-level security/);
  });

  it("cannot promote themselves or add Volunteers", async () => {
    expect(
      (await run(volunteer, `update volunteers set role_id = $2 where user_id = $1`, [volunteer, ids.coordinatorRole])).affected,
    ).toBe(0);
    await expect(run(volunteer, `select set_user_access($1, $2)`, [resident, ids.volunteerRole])).rejects.toThrow(
      /Your role does not allow this \(needs "Add users"\)/,
    );
    await expect(
      run(volunteer, `insert into volunteers (user_id, display_name, role_id) values ($1, 'x', $2)`, [
        resident,
        ids.volunteerRole,
      ]),
    ).rejects.toThrow(/row-level security/);
  });

  it("cannot read Reporters' contact details or rate-limit hashes", async () => {
    expect((await run(volunteer, `select * from report_followers`)).rows).toHaveLength(0);
    expect((await run(volunteer, `select * from report_secrets`)).rows).toHaveLength(0);
  });
});

describe("a Coordinator", () => {
  it("can manage Categories, Responsible Offices and other Volunteers", async () => {
    expect((await run(coordinator, `update categories set sort_order = sort_order where id = $1`, [ids.roads])).affected).toBe(1);
    expect((await run(coordinator, `update responsible_offices set active = active where id = $1`, [ids.ceo])).affected).toBe(1);
    await run(coordinator, `select set_user_access($1, $2)`, [volunteer, ids.volunteerRole]);
  });

  it("cannot change their own role or access", async () => {
    await expect(run(coordinator, `select set_user_access($1, $2)`, [coordinator, ids.volunteerRole])).rejects.toThrow(
      /cannot_change_own_access/,
    );
    await expect(run(coordinator, `select set_user_access($1, null)`, [coordinator])).rejects.toThrow(
      /cannot_change_own_access/,
    );
    expect((await run(coordinator, `update volunteers set active = false where user_id = $1`, [coordinator])).affected).toBe(0);
  });

  it("adds Volunteers only through invite_volunteer and set_user_access", async () => {
    await expect(
      run(coordinator, `insert into volunteers (user_id, display_name, role_id) values ($1, 'x', $2)`, [
        resident,
        ids.volunteerRole,
      ]),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("a deactivated Volunteer", () => {
  it("loses access at once, even while still signed in", async () => {
    const report = await submit();
    await expect(run(deactivated, `select resolve_report($1)`, [report])).rejects.toThrow(/Volunteer access required/);
    expect((await run(deactivated, `select id from reports`)).rows.map((r) => r.id)).not.toContain(report);
  });
});
