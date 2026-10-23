// The permission matrix: each area's View, Add, Edit, Delete, Archive, Print, Export,
// Review and Send are separate, and the upgrade from the old permissions keeps every
// role's access.
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { applyMigrations, as, CITY_HALL, createDb, createUser, createVolunteer, type Db } from "./harness";

const MATRIX_MIGRATION = "20261020000100";

let db: Db;
let admin: string;
let ids: { roads: string; ceo: string; roadsSize: string };

async function run(userId: string, sql: string, params: unknown[] = []) {
  const result = await as(db, "authenticated", userId, (tx) => tx.query<Record<string, unknown>>(sql, params));
  return { rows: result.rows, affected: result.affectedRows ?? 0 };
}

/** A Volunteer whose role has exactly these permissions. */
async function volunteerWith(permissions: string[]) {
  const name = `Role ${randomUUID().slice(0, 8)}`;
  const { rows } = await db.query<{ id: string }>(`insert into roles (name) values ($1) returning id`, [name]);
  for (const permission of permissions) {
    await db.query(`insert into role_permissions (role_id, permission) values ($1, $2)`, [rows[0].id, permission]);
  }
  return { userId: await createVolunteer(db, `${randomUUID()}@example.org`, name), roleId: rows[0].id };
}

async function submit() {
  const id = randomUUID();
  await as(db, "service_role", null, (tx) =>
    tx.query(`select submit_report($1, $2, $3, $4, '', '', $5, $6, 'hash', $7, $8)`, [
      id,
      ids.roads,
      CITY_HALL.lng,
      CITY_HALL.lat,
      JSON.stringify([{ question_id: ids.roadsSize, value: "large" }]),
      [`${id}/1.jpg`],
      "ip-" + id,
      "device-" + id,
    ]),
  );
  return id;
}

async function publish(reportId: string) {
  await run(admin, `select set_photo_review(p.id, p.original_path, false) from report_photos p where report_id = $1`, [
    reportId,
  ]);
  await run(admin, `select review_approve($1, $2, $3)`, [reportId, ids.roads, ids.ceo]);
}

beforeAll(async () => {
  db = await createDb();
  admin = await createVolunteer(db, "admin@example.org", "Coordinator");
  const one = async (sql: string) => (await db.query<{ id: string }>(sql)).rows[0].id;
  ids = {
    roads: await one(`select id from categories where slug = 'roads-potholes'`),
    ceo: await one(`select id from responsible_offices where short_name = 'CEO'`),
    roadsSize: await one(`select id from category_questions where prompt_en = 'How big is it?'`),
  };
}, 60_000);

describe("upgrading from the old permissions", () => {
  it("gives every existing role the same access in the matrix", async () => {
    const old = await createDb({ before: MATRIX_MIGRATION });
    const roles: Record<string, string[]> = {
      Reviewer: ["reports.review"],
      "Follow-up": ["reports.manage"],
      "Office keeper": ["offices.manage"],
      Gatekeeper: ["users.manage"],
      Empty: [],
    };
    for (const [name, permissions] of Object.entries(roles)) {
      const { rows } = await old.query<{ id: string }>(`insert into roles (name) values ($1) returning id`, [name]);
      for (const permission of permissions) {
        await old.query(`insert into role_permissions values ($1, $2)`, [rows[0].id, permission]);
      }
    }

    await applyMigrations(old, (file) => file >= MATRIX_MIGRATION);

    const { rows } = await old.query<{ name: string; permissions: string[] }>(
      `select r.name, array_agg(rp.permission order by rp.permission) as permissions
       from roles r join role_permissions rp on rp.role_id = r.id group by r.name`,
    );
    const after = Object.fromEntries(rows.map((r) => [r.name, r.permissions]));
    const all = (await old.query<{ key: string }>(`select key from permissions order by key`)).rows.map((r) => r.key);

    expect(after).toEqual({
      Coordinator: all,
      Volunteer: [
        "digests.add", "digests.delete", "digests.edit", "digests.print", "digests.send", "digests.view",
        "reports.archive", "reports.edit", "reports.review", "reports.view",
      ],
      Reviewer: ["digests.view", "reports.archive", "reports.review", "reports.view"],
      "Follow-up": ["digests.view", "reports.edit", "reports.view"],
      "Office keeper": ["digests.view", "offices.add", "offices.archive", "offices.edit", "offices.view", "reports.view"],
      Gatekeeper: ["digests.view", "reports.view", "users.add", "users.archive", "users.edit", "users.view"],
      Empty: ["digests.view", "reports.view"],
    });
    expect(all).toHaveLength(29);
    expect(all).not.toContain("reports.manage");
    await old.close();
  }, 120_000);
});

describe("View", () => {
  it("decides who sees Reports in Review, their history, and Digests", async () => {
    const report = await submit();
    const nobody = await volunteerWith([]);
    const viewer = await volunteerWith(["reports.view", "digests.view"]);

    const sees = async (userId: string, sql: string) => (await run(userId, sql, [report])).rows.length;
    expect(await sees(nobody.userId, `select id from reports where id = $1`)).toBe(0);
    expect(await sees(nobody.userId, `select id from report_events where report_id = $1`)).toBe(0);
    expect(await sees(viewer.userId, `select id from reports where id = $1`)).toBe(1);
    expect(await sees(viewer.userId, `select id from report_events where report_id = $1`)).toBe(1);

    await publish(report);
    const digest = (await run(admin, `select create_digest($1) as id`, [ids.ceo])).rows[0].id;
    expect((await run(nobody.userId, `select id from digests where id = $1`, [digest])).rows).toHaveLength(0);
    expect((await run(viewer.userId, `select id from digests where id = $1`, [digest])).rows).toHaveLength(1);
    await run(admin, `select discard_digest($1)`, [digest]);
  });
});

describe("Reports", () => {
  it("separates Review, Archive (take down) and Edit", async () => {
    const reviewer = await volunteerWith(["reports.view", "reports.review"]);
    const archiver = await volunteerWith(["reports.view", "reports.archive"]);

    const pending = await submit();
    await expect(run(archiver.userId, `select review_reject($1, 'x')`, [pending])).rejects.toThrow(/needs "Review Reports"/);
    await run(reviewer.userId, `select review_reject($1, 'Not a public-space problem')`, [pending]);

    const published = await submit();
    await publish(published);
    await expect(run(reviewer.userId, `select review_reject($1, 'x')`, [published])).rejects.toThrow(
      /needs "Archive Reports"/,
    );
    await expect(run(reviewer.userId, `select resolve_report($1)`, [published])).rejects.toThrow(/needs "Edit Reports"/);
    await run(archiver.userId, `select review_reject($1, 'Posted by mistake')`, [published]);
  });
});

describe("Digests", () => {
  it("separates Add, Edit, Delete and Send", async () => {
    const adder = await volunteerWith(["digests.view", "digests.add"]);
    const sender = await volunteerWith(["digests.view", "digests.send"]);
    const report = await submit();
    await publish(report);

    const digest = (await run(adder.userId, `select create_digest($1) as id`, [ids.ceo])).rows[0].id;
    await expect(run(adder.userId, `select remove_from_digest($1, $2)`, [digest, report])).rejects.toThrow(
      /needs "Edit Digests"/,
    );
    await expect(run(adder.userId, `select discard_digest($1)`, [digest])).rejects.toThrow(/needs "Delete Digests"/);
    await expect(run(adder.userId, `select * from send_digest($1, 'letter')`, [digest])).rejects.toThrow(
      /needs "Send Digests"/,
    );
    await run(sender.userId, `select * from send_digest($1, 'letter')`, [digest]);
  });
});

describe("Categories and Responsible Offices", () => {
  it("need Edit to change them, Archive to deactivate them, and Add to create them", async () => {
    const editor = await volunteerWith(["categories.view", "categories.edit"]);
    const archiver = await volunteerWith(["categories.view", "categories.archive"]);

    expect((await run(editor.userId, `update categories set sort_order = sort_order + 0 where id = $1`, [ids.roads])).affected).toBe(1);
    await expect(run(editor.userId, `update categories set active = false where id = $1`, [ids.roads])).rejects.toThrow(
      /needs "Archive Categories"/,
    );
    await run(archiver.userId, `update categories set active = false where id = $1`, [ids.roads]);
    await run(archiver.userId, `update categories set active = true where id = $1`, [ids.roads]);
    await expect(
      run(archiver.userId, `update categories set name_en = 'Roads' where id = $1`, [ids.roads]),
    ).rejects.toThrow(/needs "Edit Categories"/);

    await expect(
      run(editor.userId, `insert into categories (slug, name_en, name_fil) values ('new-one', 'New', 'Bago')`),
    ).rejects.toThrow(/row-level security/);
    const adder = await volunteerWith(["categories.view", "categories.add"]);
    await run(adder.userId, `insert into categories (slug, name_en, name_fil) values ('new-one', 'New', 'Bago')`);
  });

  it("are never deleted, even by a Coordinator, because Reports point at them", async () => {
    expect((await run(admin, `delete from responsible_offices where id = $1`, [ids.ceo])).affected).toBe(0);
    expect((await run(admin, `delete from categories where id = $1`, [ids.roads])).affected).toBe(0);
  });

  it("apply the same split to offices", async () => {
    const editor = await volunteerWith(["offices.view", "offices.edit"]);
    await expect(
      run(editor.userId, `update responsible_offices set active = false where id = $1`, [ids.ceo]),
    ).rejects.toThrow(/needs "Archive Responsible Offices"/);
  });
});

describe("Users", () => {
  it("separates Add (invite, grant), Edit (change role) and Archive (remove access)", async () => {
    const viewerRole = (await volunteerWith(["reports.view"])).roleId;
    const adder = await volunteerWith(["users.view", "users.add", "reports.view"]);
    const resident = await createUser(db, `${randomUUID()}@example.org`);

    await run(adder.userId, `select set_user_access($1, $2)`, [resident, viewerRole]);
    await run(adder.userId, `select invite_volunteer($1, $2)`, [`${randomUUID()}@example.org`, viewerRole]);
    await expect(run(adder.userId, `select set_user_access($1, $2)`, [resident, adder.roleId])).rejects.toThrow(
      /needs "Edit users"/,
    );
    await expect(run(adder.userId, `select set_user_access($1, null)`, [resident])).rejects.toThrow(
      /needs "Archive users"/,
    );
    // Inviting the address of someone who already has access would change their role.
    const residentEmail = (await db.query<{ email: string }>(`select email from auth.users where id = $1`, [resident]))
      .rows[0].email;
    await expect(
      run(adder.userId, `select invite_volunteer($1, $2)`, [residentEmail, adder.roleId]),
    ).rejects.toThrow(/needs "Edit users"/);

    const archiver = await volunteerWith(["users.view", "users.archive", "reports.view"]);
    await run(archiver.userId, `select set_user_access($1, null)`, [resident]);
  });
});

describe("Roles", () => {
  it("separates Add, Edit and Delete", async () => {
    const adder = await volunteerWith(["roles.view", "roles.add"]);
    const { rows } = await run(adder.userId, `select save_role(null, $1, null, '{reports.view}') as id`, [
      `Made ${randomUUID().slice(0, 8)}`,
    ]);
    const made = rows[0].id;
    await expect(run(adder.userId, `select save_role($1, 'Renamed', null, '{}')`, [made])).rejects.toThrow(
      /needs "Edit roles"/,
    );
    await expect(run(adder.userId, `select delete_role($1)`, [made])).rejects.toThrow(/needs "Delete roles"/);

    const deleter = await volunteerWith(["roles.view", "roles.delete"]);
    await run(deleter.userId, `select delete_role($1)`, [made]);
  });
});
