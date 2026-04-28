import { CheckSquare, User, FileText } from "lucide-react";

export type ItemSource = "specific" | "general" | "custom" | "library" | "existing";

interface SourcePillProps {
  source: ItemSource;
  rideTypeName?: string;
  className?: string;
}

const META: Record<ItemSource, { label: string; icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  specific: {
    label: "Ride-specific",
    icon: CheckSquare,
    cls: "bg-primary/10 text-primary border-primary/40",
  },
  general: {
    label: "General",
    icon: CheckSquare,
    cls: "bg-primary/10 text-primary border-primary/40",
  },
  custom: {
    label: "Custom",
    icon: User,
    cls: "bg-warning/10 text-warning border-warning/40",
  },
  library: {
    label: "Library",
    icon: CheckSquare,
    cls: "bg-primary/10 text-primary border-primary/40",
  },
  existing: {
    label: "Existing template",
    icon: FileText,
    cls: "bg-card text-foreground border-border",
  },
};

export const SourcePill = ({ source, rideTypeName, className = "" }: SourcePillProps) => {
  const m = META[source];
  const Icon = m.icon;
  const label = source === "specific"
    ? `Specific • ${rideTypeName || "Equipment"}`
    : source === "general"
      ? "General • Operational"
      : m.label;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none ${m.cls} ${className}`}
    >
      <Icon className="h-2.5 w-2.5 shrink-0" />
      <span className="truncate max-w-[140px]">{label}</span>
    </span>
  );
};

export default SourcePill;
