import { createElement } from "react";
import { render } from "react-email";
import { describe, expect, it } from "vitest";
import ReportNotice, { type ReportNoticeProps } from "./report-notice";

const props: ReportNoticeProps = { ...ReportNotice.PreviewProps };

describe("ReportNotice", () => {
  it("renders the status, message, button and fallback link", async () => {
    const html = await render(createElement(ReportNotice, props));
    expect(html).toContain('lang="en"');
    expect(html).toContain("CBN-7K2QXD");
    expect(html).toContain("Forwarded");
    expect(html).toContain("View your report");
    expect(html.match(/href="https:\/\/sumbong\.bettercabanatuan\.org\/r\/CBN-7K2QXD\?t=preview"/g)).toHaveLength(2);
  });

  it("escapes text from Volunteers, such as a rejection reason", async () => {
    const html = await render(
      createElement(ReportNotice, { ...props, status: "rejected", body: 'Reason: <img src=x onerror="alert(1)">' }),
    );
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x");
  });

  it("marks Filipino emails as Filipino", async () => {
    const html = await render(createElement(ReportNotice, { ...props, locale: "fil" }));
    expect(html).toContain('lang="fil"');
  });
});
