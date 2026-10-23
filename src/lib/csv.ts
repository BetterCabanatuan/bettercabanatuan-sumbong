type Cell = string | number | boolean | null | undefined;

/**
 * A CSV file that opens cleanly in Excel and Google Sheets: UTF-8 with a byte-order mark,
 * CRLF line endings, and cells starting with = + - @ prefixed with ' so text that
 * residents typed can't run as a spreadsheet formula.
 */
export function toCsv(header: string[], rows: Cell[][]): string {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}

function csvCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** The response for a CSV download named like `reports-2026-10-20.csv` (Manila date). */
export function csvResponse(name: string, csv: string): Response {
  const date = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
