import { createElement } from "react";
import { render } from "react-email";
import { describe, expect, it } from "vitest";
import VolunteerInvite from "./volunteer-invite";

describe("VolunteerInvite", () => {
  it("renders the role, the sign-in button and its fallback link", async () => {
    const html = await render(createElement(VolunteerInvite, VolunteerInvite.PreviewProps));
    expect(html).toContain("Volunteer");
    expect(html).toContain("Accept and sign in");
    expect(html.match(/href="https:\/\/sumbong\.bettercabanatuan\.org\/auth\/confirm\?token_hash=preview&amp;type=invite&amp;next=%2Fv"/g)).toHaveLength(2);
  });

  it("escapes the role name, which Coordinators choose", async () => {
    const html = await render(
      createElement(VolunteerInvite, { ...VolunteerInvite.PreviewProps, roleName: '<img src=x onerror="alert(1)">' }),
    );
    expect(html).not.toContain("<img src=x");
  });
});
