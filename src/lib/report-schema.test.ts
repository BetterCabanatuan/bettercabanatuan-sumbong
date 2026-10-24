import { describe, expect, it } from "vitest";
import { fromReportFormData, reportFields, toReportFormData } from "./report-schema";

const valid = {
  category_id: "7f1c3c4e-2b8a-4d6e-9a1f-0c2d3e4f5a6b",
  lat: 15.4865,
  lng: 120.9667,
  title: "  Baha sa kanto ",
  landmark: "Tapat ng palengke",
  description: "",
  email: "",
  locale: "fil",
  answers: [{ question_id: "0b6f2a1d-3c4e-4f5a-8b9c-1d2e3f4a5b6c", value: "yes" }],
};

describe("reportFields", () => {
  it("reads back on the server what the form sent", () => {
    const sent = reportFields.parse(valid);
    const form = toReportFormData(sent, [new Blob(["x"])], "token");
    expect(reportFields.parse(fromReportFormData(form))).toEqual(sent);
    expect(sent.title).toBe("Baha sa kanto");
    expect(form.getAll("photos")).toHaveLength(1);
    expect(form.get("cf-turnstile-response")).toBe("token");
  });

  it("accepts a blank email and rejects a malformed one", () => {
    expect(reportFields.safeParse({ ...valid, email: "" }).success).toBe(true);
    const result = reportFields.safeParse({ ...valid, email: "juan@" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(["email"]);
  });

  it("rejects text over its limit", () => {
    expect(reportFields.safeParse({ ...valid, title: "x".repeat(121) }).success).toBe(false);
    expect(reportFields.safeParse({ ...valid, description: "x".repeat(2001) }).success).toBe(false);
  });

  it("rejects a body with a missing pin or broken answers", () => {
    const form = toReportFormData(reportFields.parse(valid), [], null);
    form.delete("lat");
    expect(reportFields.safeParse(fromReportFormData(form)).success).toBe(false);

    const broken = toReportFormData(reportFields.parse(valid), [], null);
    broken.set("answers", "{not json");
    expect(reportFields.safeParse(fromReportFormData(broken)).success).toBe(false);
  });

  it("treats missing optional fields as empty", () => {
    const form = new FormData();
    form.set("category_id", valid.category_id);
    form.set("lat", "15.4865");
    form.set("lng", "120.9667");
    expect(reportFields.parse(fromReportFormData(form))).toMatchObject({ title: "", email: "", answers: [] });
  });
});
