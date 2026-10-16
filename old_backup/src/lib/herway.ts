export type Category = "harassment" | "stalking" | "sexual_assault" | "other";
export type ReportType = "firsthand" | "witnessed" | "disclosed";
export type PublishedIncident = {
  id: string; category: Category; report_type: ReportType; lat: number; lng: number;
  area_label: string; date_from: string; date_to: string; summary: string | null; is_sample: boolean;
};
export const BD_CENTER: [number, number] = [90.35, 23.8];
export const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";
export const CATEGORIES: { value: Category; label: string }[] = [
  { value: "harassment", label: "Harassment" }, { value: "stalking", label: "Stalking" },
  { value: "sexual_assault", label: "Sexual assault" }, { value: "other", label: "Other concern" },
];
export const categoryLabel = (c: Category) => CATEGORIES.find((x) => x.value === c)!.label;
export const CATEGORY_HEX: Record<Category, string> = { harassment: "#b8457f", stalking: "#7452c2", sexual_assault: "#1f7a84", other: "#86687a" };
export const REPORT_TYPES: { value: ReportType; label: string; hint: string }[] = [
  { value: "firsthand", label: "Experienced", hint: "Reported by the person it happened to" },
  { value: "witnessed", label: "Witnessed", hint: "Reported by someone who saw it happen" },
  { value: "disclosed", label: "Secondhand", hint: "Someone told the reporter about it" },
];
export const PERIODS = [{ d: 30, label: "30 days" }, { d: 90, label: "90 days" }, { d: 365, label: "12 months" }, { d: 0, label: "All" }];
export const NOTICE = "This map displays community-reported incidents. It is not a complete record of crime, and it cannot guarantee that any location is safe or unsafe.";

const S = (n: number, category: Category, report_type: ReportType, lat: number, lng: number, area_label: string, date_from: string, date_to: string, summary: string): PublishedIncident =>
  ({ id: `sample-${n}`, category, report_type, lat, lng, area_label, date_from, date_to, summary, is_sample: true });
// Synthetic preview data — used only when no backend is connected.
export const SAMPLE_INCIDENTS: PublishedIncident[] = [
  S(1, "harassment", "witnessed", 22.3626, 91.8116, "Near GEC Circle, Chattogram", "2026-08-10", "2026-08-10", "Unwanted comments and following reported on a busy footpath."),
  S(2, "other", "firsthand", 23.7354, 90.3744, "Near Dhanmondi, Dhaka", "2026-08-24", "2026-08-24", "Poor lighting and an uncomfortable encounter reported near an underpass."),
  S(3, "stalking", "firsthand", 23.6308, 90.491, "Near Narayanganj Chashara", "2026-06-06", "2026-06-19", "Repeated following reported between a market and residential lanes."),
  S(4, "harassment", "firsthand", 24.886, 91.8783, "Near Zindabazar, Sylhet", "2026-09-03", "2026-09-09", "Verbal harassment reported near a bus stop during evening hours."),
  S(5, "harassment", "disclosed", 23.768, 90.4002, "Near Mohakhali, Dhaka", "2026-09-18", "2026-09-24", "Harassment reported on a crowded public bus."),
  S(6, "stalking", "firsthand", 23.7394, 90.3853, "Near Shahbagh, Dhaka", "2026-08-29", "2026-09-11", "Repeated following reported between a market and residential lanes."),
  S(7, "sexual_assault", "witnessed", 23.8617, 90.4024, "Near Uttara Sector 7, Dhaka", "2026-05-02", "2026-05-15", "Physical assault reported in a crowded transport setting. Details withheld for privacy."),
  S(8, "other", "witnessed", 23.4677, 91.1802, "Near Kandirpar, Cumilla", "2026-02-08", "2026-02-14", "Safety concern reported near a quiet stretch after dark."),
  S(9, "harassment", "firsthand", 22.8275, 89.5468, "Near Shibbari, Khulna", "2026-09-26", "2026-09-26", "Unwanted comments reported on a busy footpath."),
  S(10, "stalking", "disclosed", 23.8141, 90.3587, "Near Mirpur 10, Dhaka", "2026-09-12", "2026-09-12", "Reporter noticed being followed on the same route several times."),
  S(11, "harassment", "firsthand", 23.7515, 90.3824, "Near Farmgate, Dhaka", "2026-06-16", "2026-06-22", "Harassment reported on a crowded public bus."),
  S(12, "harassment", "witnessed", 23.7787, 90.4234, "Near Badda, Dhaka", "2026-07-13", "2026-07-19", "Verbal harassment reported near a bus stop during evening hours."),
];
