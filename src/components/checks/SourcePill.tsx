import { Sparkles, Library, User, FileText } from "lucide-react";

export type ItemSource = "specific" | "general" | "custom" | "library" | "existing";

interface SourcePillProps {
  source: ItemSource;
  rideTypeName?: string;
  className?: string;
}

const META: Record<ItemSource, { label: string; icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  specific: {
    label: "Ride-specific",
    icon: Sparkles,
    cls: "bg-primary/10 text-primary border-primary/30",
  },
  general: {
    label: "General",
    icon: Library,
    cls: "bg-muted text-muted-foreground border-border",
  },
  custom: {
    label: "Custom",
    icon: User,
    cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  },
  library: {
    label: "Library",
    icon: Library,
    cls: "bg-secondary text-secondary-foreground border-border",
  },
  existing: {
    label: "Existing template",
    icon: FileText,
    cls: "bg-muted text-foreground border-border",
  },
};

export const SourcePill = ({ source, rideTypeName, className = "" }: SourcePillProps) => {
  const m = META[source];
  const Icon = m.icon;
  const label = source === "specific" && rideTypeName ? `Specific • ${rideTypeName}` : m.label;
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
