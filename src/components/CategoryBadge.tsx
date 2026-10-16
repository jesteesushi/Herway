import { MessageSquareWarning, Footprints, Shield, CircleDot, User, Eye, MessageCircle } from "lucide-react";
import { categoryLabel, REPORT_TYPES, type Category, type ReportType } from "@/lib/herway";
import { cn } from "@/lib/utils";

const CAT_ICON = { harassment: MessageSquareWarning, stalking: Footprints, sexual_assault: Shield, other: CircleDot };
const CAT_CLASS: Record<Category, string> = {
  harassment: "bg-cat-harassment/12 text-cat-harassment",
  stalking: "bg-cat-stalking/12 text-cat-stalking",
  sexual_assault: "bg-cat-assault/12 text-cat-assault",
  other: "bg-cat-other/12 text-cat-other",
};
const TYPE_ICON = { firsthand: User, witnessed: Eye, disclosed: MessageCircle };

export function CategoryIcon({ category, className }: { category: Category; className?: string }) {
  const Icon = CAT_ICON[category];
  return <Icon className={className} aria-hidden />;
}

export function CategoryBadge({ category, className }: { category: Category; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", CAT_CLASS[category], className)}>
      <CategoryIcon category={category} className="size-3.5" />
      {categoryLabel(category)}
    </span>
  );
}

export function ReportTypeBadge({ type }: { type: ReportType }) {
  const Icon = TYPE_ICON[type];
  const t = REPORT_TYPES.find((r) => r.value === type)!;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs font-medium text-foreground">
      <Icon className="size-3.5" aria-hidden />
      {t.label}
    </span>
  );
}
