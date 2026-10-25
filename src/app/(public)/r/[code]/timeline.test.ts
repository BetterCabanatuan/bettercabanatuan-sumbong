import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Timeline, type TimelineItem } from "./timeline";

const items: TimelineItem[] = [
  { key: "resolved", kind: "resolved", office: true, title: "Resolved", date: "Oct 20, 2026" },
  { key: "forwarded", kind: "forwarded", office: true, title: "Forwarded to CEO", date: "Oct 12, 2026" },
  { key: "meToo", kind: "meToo", title: "40 residents said “Ako rin”" },
  { key: "published", kind: "published", title: "Reviewed and published", date: "Oct 10, 2026" },
  { key: "submitted", kind: "submitted", title: "Submitted", date: "Oct 9, 2026" },
];

const render = (list: TimelineItem[]) =>
  renderToStaticMarkup(createElement(Timeline, { items: list, officePhaseLabel: "With the Responsible Office" }));

describe("Timeline", () => {
  it("is an ordered list with one decorative badge per event and a decorative office break", () => {
    const html = render(items);
    expect(html.startsWith("<ol")).toBe(true);
    // 5 events + 1 break
    expect(html.match(/<li/g)).toHaveLength(6);
    // 5 badges, their 5 icons and the break, all hidden from screen readers
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(11);
  });

  it("puts the office break once, before the first office event", () => {
    const html = render(items);
    expect(html.match(/With the Responsible Office/g)).toHaveLength(1);
    expect(html.indexOf("With the Responsible Office")).toBeLessThan(html.indexOf("Resolved"));
  });

  it("has no office break when nothing happened at the office yet", () => {
    const html = render(items.slice(3));
    expect(html).not.toContain("With the Responsible Office");
  });

  it("staggers the first eight badges in 50ms steps and no more", () => {
    const many: TimelineItem[] = Array.from({ length: 10 }, (_, i) => ({ key: `k${i}`, kind: "published", title: `E${i}` }));
    const html = render(many);
    expect(html).toContain("animation-delay:0ms");
    expect(html).toContain("animation-delay:350ms");
    expect(html).not.toContain("animation-delay:400ms");
  });

  it("sets the Me too milestone smaller than a status change", () => {
    const html = render(items);
    expect(html).toMatch(/text-xs text-muted-foreground[^>]*><span class="font-medium">40 residents/);
  });
});
