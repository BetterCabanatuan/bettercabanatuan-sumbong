import { describe, expect, it } from "vitest";
import { checkVolunteerForm, formValues } from "./volunteer-forms";

const ID = "7f1c3c4e-2b8a-4d6e-9a1f-0c2d3e4f5a6b";

function form(entries: [string, string][]) {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

describe("formValues", () => {
  it("turns a repeated name into a list", () => {
    expect(formValues(form([["permissions", "reports.view"], ["permissions", "digests.view"], ["name", "x"]]))).toEqual({
      permissions: ["reports.view", "digests.view"],
      name: "x",
    });
  });
});

describe("checkVolunteerForm", () => {
  it("names the field that is wrong", () => {
    const result = checkVolunteerForm("office", form([["short_name", " "], ["name_en", "Engineering"], ["scope", "citywide"]]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fields).toMatchObject({
      short_name: "Give it a short name.",
      name_fil: "Give it a Filipino name.",
      channel: "Say how a Digest reaches this office.",
    });
    expect(result.error).toBe("Give it a short name.");
  });

  it("turns blank optional fields into null and checks an office email", () => {
    const base: [string, string][] = [
      ["short_name", "CEO"],
      ["name_en", "City Engineering Office"],
      ["name_fil", "Tanggapan ng Inhinyero"],
      ["scope", "citywide"],
      ["channel", "Letter"],
    ];
    const ok = checkVolunteerForm("office", form([...base, ["email", ""], ["phone", "  "]]));
    expect(ok).toMatchObject({ ok: true, data: { id: null, email: null, phone: null } });
    const bad = checkVolunteerForm("office", form([...base, ["email", "ceo@"]]));
    expect(bad.ok || bad.fields.email).toBe("Enter a valid email address.");
  });

  it("asks for a reason the way each reject form needs one", () => {
    expect(checkVolunteerForm("reject", form([["from", "review"], ["preset", ""], ["reason", "x"]]))).toMatchObject({
      ok: false,
      fields: { preset: "Pick a reason." },
    });
    expect(checkVolunteerForm("reject", form([["preset", "Taken down"], ["reason", ""]]))).toMatchObject({
      ok: false,
      fields: { reason: "Give a reason." },
    });
    expect(checkVolunteerForm("reject", form([["from", "review"], ["preset", "Abusive or spam"], ["reason", " repeat "]]))).toEqual({
      ok: true,
      data: { fromReview: true, reason: "Abusive or spam: repeat" },
    });
  });

  it("parses Category Question choices and needs two of them", () => {
    const base: [string, string][] = [
      ["category_id", ID],
      ["prompt_en", "How deep?"],
      ["prompt_fil", "Gaano kalalim?"],
      ["kind", "choice"],
      ["required", "on"],
    ];
    expect(checkVolunteerForm("question", form([...base, ["choices", "ankle | Ankle"]]))).toMatchObject({
      ok: false,
      fields: { choices: "A choice question needs at least 2 options." },
    });
    expect(checkVolunteerForm("question", form([...base, ["choices", "ankle | Ankle | Bukung-bukong\nknee"]]))).toMatchObject({
      ok: true,
      data: {
        choices: [
          { value: "ankle", label_en: "Ankle", label_fil: "Bukung-bukong" },
          { value: "knee", label_en: "knee", label_fil: "knee" },
        ],
        required: true,
        active: false,
        sort_order: 0,
      },
    });
  });

  it("reads a send time as Manila time and refuses one in the future", () => {
    const sent = checkVolunteerForm("sendDigest", form([["channel", "letter"], ["sent_at", "2026-10-20T09:30"]]));
    expect(sent.ok && sent.data.sentAt.toISOString()).toBe("2026-10-20T01:30:00.000Z");
    expect(checkVolunteerForm("sendDigest", form([["channel", "letter"], ["sent_at", "2999-01-01T00:00"]]))).toMatchObject({
      ok: false,
      fields: { sent_at: "The send time can't be in the future." },
    });
  });

  it("lowercases slugs and invitation emails", () => {
    const category = checkVolunteerForm("category", form([["slug", " Flooding "], ["name_en", "Flooding"], ["name_fil", "Baha"]]));
    expect(category).toMatchObject({ ok: true, data: { slug: "flooding", icon: "circle-alert", default_office_id: null } });
    const invite = checkVolunteerForm("invite", form([["email", " Juan@Example.org "], ["role_id", ID]]));
    expect(invite).toMatchObject({ ok: true, data: { email: "juan@example.org", display_name: null } });
  });

  it("removes access with role none and rejects unknown permissions", () => {
    expect(checkVolunteerForm("userAccess", form([["user_id", ID], ["role_id", "none"]]))).toMatchObject({
      ok: true,
      data: { role_id: null },
    });
    expect(checkVolunteerForm("role", form([["name", "Helper"], ["permissions", "reports.delete"]])).ok).toBe(false);
    expect(checkVolunteerForm("role", form([["name", "Helper"]]))).toMatchObject({ ok: true, data: { permissions: [] } });
  });
});
