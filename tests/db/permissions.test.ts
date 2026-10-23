// Roles and permissions: custom roles, user management, Volunteer Invitations and
// the rules that keep a project from locking itself out.
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { applyMigrations, as, CITY_HALL, createDb, createUser, createVolunteer, type Db } from "./harness";

let db: Db;
let admin: string;
let secondAdmin: string;
let ids: { roads: string; ceo: string; roadsSize: string; volunteerRole: string; coordinatorRole: string };

async function run(userId: string, sql: string, params: unknown[] = []) {
  const result = await as(db, "authenticated", userId, (tx) => tx.query<Record<string, unknown>>(sql, params));
  return { rows: result.rows, affected: result.affectedRows ?? 0 };
}

async function saveRole(userId: string, name: string, permissions: string[], roleId: string | null = null) {
  const { rows } = await run(userId, `select save_role($1, $2, null, $3) as id`, [roleId, name, permissions]);
  return rows[0].id as string;
}

async function roleOf(userId: string) {
  const { rows } = await db.query<{ name: string | null; active: boolean }>(
    `select r.name, v.active from volunteers v left join roles r on r.id = v.role_id where v.user_id = $1`,
    [userId],
  );
  return rows[0] ?? null;
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

beforeAll(async () => {
  db = await createDb();
  admin = await createVolunteer(db, "admin@example.org", "Coordinator");
  secondAdmin = await createVolunteer(db, "admin2@example.org", "Coordinator");

  const one = async (sql: string) => (await db.query<{ id: string }>(sql)).rows[0].id;
  ids = {
    roads: await one(`select id from categories where slug = 'roads-potholes'`),
    ceo: await one(`select id from responsible_offices where short_name = 'CEO'`),
    roadsSize: await one(`select id from category_questions where prompt_en = 'How big is it?'`),
    volunteerRole: await one(`select id from roles where name = 'Volunteer'`),
    coordinatorRole: await one(`select id from roles where name = 'Coordinator'`),
  };
}, 60_000);

describe("the built-in roles", () => {
  it("give Volunteers the Report and Digest work and Coordinators every permission", async () => {
    const { rows } = await db.query<{ name: string; permissions: string[] }>(
      `select r.name, array_agg(rp.permission order by rp.permission) as permissions
       from roles r join role_permissions rp on rp.role_id = r.id group by r.name order by r.name`,
    );
    const all = (await db.query<{ key: string }>(`select key from permissions order by key`)).rows.map((r) => r.key);
    expect(rows).toEqual([
      { name: "Coordinator", permissions: all },
      {
        name: "Volunteer",
        permissions: [
          "digests.add", "digests.delete", "digests.edit", "digests.print", "digests.send", "digests.view",
          "reports.archive", "reports.edit", "reports.review", "reports.view",
        ],
      },
    ]);
  });
});

describe("a custom role", () => {
  it("allows exactly the permissions it was given", async () => {
    const sender = await saveRole(admin, "Digest sender", ["digests.view", "digests.add"]);
    const user = await createVolunteer(db, "sender@example.org", "Digest sender");
    expect(sender).toBeTruthy();

    const report = await submit();
    await expect(run(user, `select review_reject($1, 'x')`, [report])).rejects.toThrow(
      /Your role does not allow this \(needs "Review Reports"\)/,
    );
    await expect(run(user, `select resolve_report($1)`, [report])).rejects.toThrow(/needs "Edit Reports"/);
    expect((await run(user, `update categories set name_en = name_en where id = $1`, [ids.roads])).affected).toBe(0);
    await expect(run(user, `select save_role(null, 'Mine', null, '{}')`)).rejects.toThrow(/needs "Add roles"/);

    // Without "View Reports" a pending Report stays hidden.
    expect((await run(user, `select id from reports where id = $1`, [report])).rows).toHaveLength(0);
    await expect(run(user, `select create_digest($1)`, [ids.ceo])).rejects.toThrow(/nothing_to_send/);
  });

  it("can manage reference data with only that permission", async () => {
    await saveRole(admin, "Office keeper", ["offices.view", "offices.edit", "offices.archive"]);
    const user = await createVolunteer(db, "offices@example.org", "Office keeper");
    expect((await run(user, `update responsible_offices set active = active where id = $1`, [ids.ceo])).affected).toBe(1);
    expect((await run(user, `update categories set active = active where id = $1`, [ids.roads])).affected).toBe(0);
  });

  it("takes effect at once when its permissions change", async () => {
    const role = await saveRole(admin, "Reviewer", []);
    const user = await createVolunteer(db, "reviewer@example.org", "Reviewer");
    const report = await submit();
    await expect(run(user, `select review_reject($1, 'x')`, [report])).rejects.toThrow(/needs "Review Reports"/);

    await saveRole(admin, "Reviewer", ["reports.review"], role);
    await run(user, `select review_reject($1, 'Not a public space')`, [report]);
  });

  it("needs a unique name and known permissions", async () => {
    await expect(saveRole(admin, "  coordinator ", [])).rejects.toThrow(/role_name_taken/);
    await expect(saveRole(admin, "Odd", ["reports.delete"])).rejects.toThrow(/unknown_permission/);
    await expect(saveRole(admin, " ", [])).rejects.toThrow(/name_required/);
  });

  it("can be deleted only when nobody active holds it", async () => {
    const role = await saveRole(admin, "Temporary", ["reports.review"]);
    const user = await createVolunteer(db, "temp@example.org", "Temporary");
    await expect(run(admin, `select delete_role($1)`, [role])).rejects.toThrow(/role_in_use/);

    await run(admin, `select set_user_access($1, null)`, [user]);
    await run(admin, `select delete_role($1)`, [role]);
    expect(await roleOf(user)).toEqual({ name: null, active: false });
  });
});

describe("user management", () => {
  it("gives a Reporter account a role and takes it away again", async () => {
    const resident = await createUser(db, "resident@example.org");
    await run(admin, `select set_user_access($1, $2)`, [resident, ids.volunteerRole]);
    expect(await roleOf(resident)).toEqual({ name: "Volunteer", active: true });

    await run(admin, `select set_user_access($1, null)`, [resident]);
    expect(await roleOf(resident)).toEqual({ name: "Volunteer", active: false });
    await expect(run(resident, `select review_reject($1, 'x')`, [await submit()])).rejects.toThrow(
      /Volunteer access required/,
    );
  });

  it("only lets you give or change roles within your own permissions", async () => {
    await saveRole(admin, "Team lead", ["users.view", "users.add", "users.edit", "users.archive", "reports.review"]);
    const lead = await createVolunteer(db, "lead@example.org", "Team lead");
    const resident = await createUser(db, "climber@example.org");

    await expect(run(lead, `select set_user_access($1, $2)`, [resident, ids.coordinatorRole])).rejects.toThrow(
      /role_exceeds_yours/,
    );
    await expect(run(lead, `select set_user_access($1, $2)`, [resident, ids.volunteerRole])).rejects.toThrow(
      /role_exceeds_yours/,
    );
    await expect(run(lead, `select set_user_access($1, null)`, [secondAdmin])).rejects.toThrow(/role_exceeds_yours/);

    const reviewerOnly = await saveRole(admin, "Review only", ["reports.review"]);
    await run(lead, `select set_user_access($1, $2)`, [resident, reviewerOnly]);
    expect(await roleOf(resident)).toEqual({ name: "Review only", active: true });
  });

  it("lists every account with its role, only for user managers", async () => {
    await createUser(db, "outsider@example.org");
    const { rows } = await run(admin, `select * from list_users('example.org', false, 200, 0)`);
    const byEmail = new Map(rows.map((r) => [r.email, r]));
    expect(byEmail.get("admin@example.org")).toMatchObject({ role_name: "Coordinator", active: true });
    expect(byEmail.get("resident@example.org")).toMatchObject({ role_name: "Volunteer", active: false });
    expect(Number(rows[0].total)).toBe(rows.length);

    const staff = await run(admin, `select * from list_users(null, true, 200, 0)`);
    expect(byEmail.get("outsider@example.org")).toMatchObject({ role_name: null, active: false });
    expect(staff.rows.map((r) => r.email)).not.toContain("outsider@example.org");
    expect(staff.rows.every((r) => r.display_name !== null)).toBe(true);

    const volunteer = await createVolunteer(db, "plain@example.org");
    await expect(run(volunteer, `select * from list_users()`)).rejects.toThrow(/needs "View users"/);
  });
});

describe("Volunteer Invitations", () => {
  it("wait for the account and apply when it is created", async () => {
    const { rows } = await run(admin, `select invite_volunteer(' New@Example.org ', $1, 'Nena') as applied`, [
      ids.volunteerRole,
    ]);
    expect(rows[0].applied).toBe(false);
    expect((await run(admin, `select email from volunteer_invitations`)).rows).toContainEqual({ email: "new@example.org" });

    const id = await createUser(db, "new@example.org");
    expect(await roleOf(id)).toEqual({ name: "Volunteer", active: true });
    expect((await db.query(`select 1 from volunteer_invitations where email = 'new@example.org'`)).rows).toHaveLength(0);
    expect((await db.query<{ display_name: string }>(`select display_name from volunteers where user_id = $1`, [id])).rows[0])
      .toEqual({ display_name: "Nena" });
  });

  it("wait until the invited address is confirmed", async () => {
    await run(admin, `select invite_volunteer('later@example.org', $1)`, [ids.volunteerRole]);
    // A password sign-up for the address, with nobody clicking the confirmation email.
    const id = await createUser(db, "later@example.org", { confirmed: false });
    expect(await roleOf(id)).toBeNull();

    await db.query(`update auth.users set last_sign_in_at = now() where id = $1`, [id]);
    expect(await roleOf(id)).toBeNull();

    await db.query(`update auth.users set email_confirmed_at = now() where id = $1`, [id]);
    expect(await roleOf(id)).toEqual({ name: "Volunteer", active: true });
    expect((await db.query(`select 1 from volunteer_invitations where email = 'later@example.org'`)).rows).toHaveLength(0);
  });

  it("apply when a confirmed account changes to the invited address", async () => {
    await run(admin, `select invite_volunteer('moved@example.org', $1)`, [ids.volunteerRole]);
    const id = await createUser(db, "before-move@example.org");
    await db.query(`update auth.users set email = 'moved@example.org' where id = $1`, [id]);
    expect(await roleOf(id)).toEqual({ name: "Volunteer", active: true });
  });

  it("are refused for an address that already has an unconfirmed account", async () => {
    // Registered with a password by someone who doesn't own the address.
    const squatter = await createUser(db, "squatted@example.org", { confirmed: false });
    await expect(
      run(admin, `select invite_volunteer('squatted@example.org', $1)`, [ids.coordinatorRole]),
    ).rejects.toThrow(/unconfirmed_account_exists/);
    expect(await roleOf(squatter)).toBeNull();
    expect((await db.query(`select 1 from volunteer_invitations where email = 'squatted@example.org'`)).rows).toHaveLength(0);

    // The owner clicking a sign-in email confirms that account; it still gets no role.
    await db.query(`update auth.users set email_confirmed_at = now() where id = $1`, [squatter]);
    expect(await roleOf(squatter)).toBeNull();
  });

  it("are not taken by an account registered before the invitation and confirmed after it", async () => {
    // As with the initial Coordinators: the invitation is written straight to the table.
    const squatter = await createUser(db, "early@example.org", { confirmed: false });
    await db.query(`insert into volunteer_invitations (email, role_id, created_at) values ('early@example.org', $1, now() + interval '1 second')`, [
      ids.coordinatorRole,
    ]);
    await db.query(`update auth.users set email_confirmed_at = now() where id = $1`, [squatter]);
    expect(await roleOf(squatter)).toBeNull();
    expect((await db.query(`select 1 from volunteer_invitations where email = 'early@example.org'`)).rows).toHaveLength(1);
  });

  it("apply at once to an existing account", async () => {
    const id = await createUser(db, "existing@example.org");
    const { rows } = await run(admin, `select invite_volunteer('existing@example.org', $1) as applied`, [ids.volunteerRole]);
    expect(rows[0].applied).toBe(true);
    expect(await roleOf(id)).toEqual({ name: "Volunteer", active: true });
  });

  it("can be cancelled by user managers only", async () => {
    await run(admin, `select invite_volunteer('cancel@example.org', $1)`, [ids.volunteerRole]);
    const volunteer = await createVolunteer(db, "nosy@example.org");
    expect((await run(volunteer, `select * from volunteer_invitations`)).rows).toHaveLength(0);
    expect((await run(volunteer, `delete from volunteer_invitations`)).affected).toBe(0);
    expect((await run(admin, `delete from volunteer_invitations where email = 'cancel@example.org'`)).affected).toBe(1);
  });

  it("make the initial Coordinators Coordinators when they first sign in", async () => {
    for (const email of ["joshuagemvicente6@gmail.com", "bettercabanatuan@gmail.com", "jp.gabornes@gmail.com"]) {
      const id = await createUser(db, email);
      expect(await roleOf(id), email).toEqual({ name: "Coordinator", active: true });
    }
  });

  it("are taken away from unconfirmed accounts that got a role before 20261023000100", async () => {
    const old = await createDb({ before: "20261023000100" });
    const unconfirmed = await createUser(old, "unconfirmed@example.org", { confirmed: false });
    const confirmed = await createUser(old, "confirmed@example.org");
    for (const id of [unconfirmed, confirmed]) {
      await old.query(
        `insert into volunteers (user_id, display_name, role_id) select $1, 'x', id from roles where name = 'Coordinator'`,
        [id],
      );
    }
    await applyMigrations(old, (file) => file >= "20261023000100");
    const { rows } = await old.query<{ user_id: string; active: boolean }>(`select user_id, active from volunteers`);
    expect(Object.fromEntries(rows.map((r) => [r.user_id, r.active]))).toEqual({ [unconfirmed]: false, [confirmed]: true });
  });
});

describe("lockout protection", () => {
  it("keeps at least one active Coordinator who can edit roles", async () => {
    const db2 = db;
    db = await createDb();
    try {
      const only = await createVolunteer(db, "only@example.org", "Coordinator");
      const other = await createVolunteer(db, "helper@example.org", "Coordinator");
      const coordinatorRole = (await db.query<{ id: string }>(`select id from roles where name = 'Coordinator'`)).rows[0].id;
      const all = (await db.query<{ key: string }>(`select key from permissions`)).rows.map((r) => r.key);

      await run(only, `select set_user_access($1, null)`, [other]);
      await expect(
        saveRole(only, "Coordinator", all.filter((k) => k !== "roles.edit"), coordinatorRole),
      ).rejects.toThrow(/last_administrator/);

      // The SQL editor (no signed-in user) can still recover a project.
      await db.query(`update volunteers set active = false where user_id = $1`, [only]);
      expect(await roleOf(only)).toEqual({ name: "Coordinator", active: false });
    } finally {
      db = db2;
    }
  }, 120_000);
});
