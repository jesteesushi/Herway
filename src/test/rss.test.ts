import { describe, expect, it } from "vitest";

const KEYWORDS = /(harass|eve[- ]?teas|stalk|assault|rape|snatch|abduct|women|girl|safety|police|arrest|violence|court|victim)/i;

function extractString(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "object") {
    const anyVal = val as any;
    if (typeof anyVal._ === "string") return anyVal._.trim();
    if (Array.isArray(anyVal.a) && anyVal.a[0]) {
      const a0 = anyVal.a[0];
      if (typeof a0 === "string") return a0.trim();
      if (typeof a0?._ === "string") return a0._.trim();
    }
    for (const v of Object.values(anyVal)) {
      if (typeof v === "string") return v.trim();
      if (typeof v === "object" && v && typeof (v as any)._ === "string") {
        return (v as any)._.trim();
      }
    }
  }
  try {
    return String(val ?? "").trim();
  } catch {
    return "";
  }
}

describe("RSS Ingest logic", () => {
  it("matches safety and crime keywords correctly", () => {
    expect(KEYWORDS.test("Police arrest suspect in harassment case")).toBe(true);
    expect(KEYWORDS.test("Safety concerns raised over eve-teasing near university")).toBe(true);
    expect(KEYWORDS.test("Stock market index rises 20 points")).toBe(false);
  });

  it("safely extracts string from complex xml2js objects without crashing", () => {
    // Test Daily Star xml2js nested anchor object
    const nestedObj = Object.create(null);
    nestedObj.a = [Object.create(null)];
    nestedObj.a[0]._ = "Police arrest suspect after assault report";

    const extracted = extractString(nestedObj);
    expect(extracted).toBe("Police arrest suspect after assault report");
    expect(KEYWORDS.test(extracted)).toBe(true);
  });
});
