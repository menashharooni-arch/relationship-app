import { describe, it, expect } from "vitest";
import { buildEmployeeAnalyticsCsv, type EmployeeCsvRow } from "@/lib/office-analytics-csv";

const baseRow: EmployeeCsvRow = {
  name: "Jane Doe",
  cardName: "Jane's card",
  views: 42,
  uniqueVisitors: 30,
  scans: 5,
  leads: 3,
  contactsSaved: 2,
  swiftlinkViews: 7,
  conversionRate: 0.25,
  lastActivityAt: "2026-03-01T12:00:00.000Z",
};

describe("buildEmployeeAnalyticsCsv", () => {
  it("emits a header row followed by one line per employee", () => {
    const csv = buildEmployeeAnalyticsCsv([baseRow]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe(
      "Employee,Card,Card views,Unique visitors,QR/NFC scans,Leads captured,Contacts saved,SwiftLink views,Conversion rate,Most recent activity"
    );
    expect(lines).toHaveLength(2);
  });

  it("quote-escapes names/card names containing commas or quotes", () => {
    const row: EmployeeCsvRow = { ...baseRow, name: 'Jane "JD" Doe, Jr.', cardName: "Acme, Inc." };
    const csv = buildEmployeeAnalyticsCsv([row]);
    const dataLine = csv.split("\n")[1];
    expect(dataLine).toContain('"Jane ""JD"" Doe, Jr."');
    expect(dataLine).toContain('"Acme, Inc."');
  });

  it("renders a null conversion rate as blank, not 0% or NaN", () => {
    const row: EmployeeCsvRow = { ...baseRow, conversionRate: null };
    const csv = buildEmployeeAnalyticsCsv([row]);
    const cols = csv.split("\n")[1].split(",");
    // Conversion rate is the 9th column.
    expect(cols[8]).toBe('""');
  });

  it("renders a real conversion rate as a percentage", () => {
    const csv = buildEmployeeAnalyticsCsv([baseRow]);
    expect(csv.split("\n")[1]).toContain("25.0%");
  });

  it("handles an empty employee list — header only, no crash", () => {
    const csv = buildEmployeeAnalyticsCsv([]);
    expect(csv.split("\n")).toHaveLength(1);
  });

  it("renders a missing lastActivityAt as blank", () => {
    const row: EmployeeCsvRow = { ...baseRow, lastActivityAt: null };
    const csv = buildEmployeeAnalyticsCsv([row]);
    const cols = csv.split("\n")[1].split(",");
    expect(cols[9]).toBe('""');
  });
});
