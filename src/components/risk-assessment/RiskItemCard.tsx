import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, ChevronDown, ChevronUp, User, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';

interface RiskItemCardProps {
  item: {
    id: string;
    hazard_description: string;
    who_at_risk: string;
    existing_controls?: string;
    additional_actions?: string;
    action_owner?: string;
    target_date?: string;
    risk_level: string;
    likelihood: string;
    severity: string;
    status: string;
    is_manually_overridden?: boolean;
  };
  strip: {
    rail: string;
    badgeBg: string;
    badgeText: string;
    label: string;
    chipBg: string;
    chipText: string;
  };
  isOverdue: boolean;
  dueDateStatus: { label: string; className: string; icon: string } | null;
  riskScore: number;
  onEdit: () => void;
  onDelete: () => void;
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  open:        { bg: 'bg-blue-50',   text: 'text-blue-800',  label: 'Open' },
  in_progress: { bg: 'bg-blue-100',  text: 'text-blue-900',  label: 'In Progress' },
  completed:   { bg: 'bg-green-50',  text: 'text-green-800', label: 'Closed' },
};

export function RiskItemCard({
  item,
  strip,
  isOverdue,
  dueDateStatus,
  riskScore,
  onEdit,
  onDelete,
}: RiskItemCardProps) {
  const [expanded, setExpanded] = useState(false);

  const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.open;

  const likelihoodLabel = item.likelihood.charAt(0).toUpperCase() + item.likelihood.slice(1);
  const severityLabel = item.severity.charAt(0).toUpperCase() + item.severity.slice(1);

  return (
    <div
      className="relative bg-white rounded-2xl border border-[#E6EAF0] overflow-hidden"
      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
    >
      {/* Left risk colour rail */}
      <div
        className={`absolute inset-y-0 left-0 w-1 rounded-l-2xl ${strip.rail}`}
      />

      <div className="pl-4 pr-4 pt-4 pb-3 ml-1">
        {/* ── HEADER ROW ── */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <h4 className="font-semibold text-[15px] leading-snug text-[#0F172A] flex-1">
            {item.hazard_description}
          </h4>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onEdit}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="Edit"
            >
              <Pencil className="h-3.5 w-3.5 text-slate-500" />
            </button>
            <button
              onClick={onDelete}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors"
              aria-label="Delete"
            >
              <Trash2 className="h-3.5 w-3.5 text-red-500" />
            </button>
          </div>
        </div>

        {/* ── BADGE ROW ── */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {/* Risk level badge */}
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${strip.chipBg} ${strip.chipText}`}
          >
            {strip.label}
          </span>

          {/* Score badge */}
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
            Score: {riskScore}/25
          </span>

          {/* Status badge */}
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusCfg.bg} ${statusCfg.text}`}>
            {statusCfg.label}
          </span>

          {/* Overdue badge */}
          {isOverdue && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-50 text-red-700">
              ⚠ Overdue
            </span>
          )}

          {/* Manual override indicator */}
          {item.is_manually_overridden && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700">
              * Professional override
            </span>
          )}
        </div>

        {/* ── WHO AT RISK ── */}
        <p className="text-[13px] text-slate-600 mb-3">
          <span className="font-medium text-slate-800">Who at risk: </span>
          {item.who_at_risk}
        </p>

        {/* ── OWNER / DUE META ROW ── */}
        {(item.action_owner || item.target_date) && (
          <div className="flex flex-wrap items-center gap-4 mb-3">
            {item.action_owner && (
              <span className="flex items-center gap-1.5 text-[13px] text-slate-600">
                <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                {item.action_owner}
              </span>
            )}
            {item.target_date && (
              <span className={`flex items-center gap-1.5 text-[13px] ${isOverdue ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>
                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                Due: {format(new Date(item.target_date), 'dd MMM yyyy')}
                {dueDateStatus && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${dueDateStatus.className}`}>
                    {dueDateStatus.label}
                  </span>
                )}
              </span>
            )}
          </div>
        )}

        {/* ── RISK SCORE BLOCK ── */}
        <div className="inline-flex items-center gap-3 rounded-xl bg-[#F1F5F9] px-3 py-2 mb-3">
          <span className="text-[13px] text-slate-600">
            <span className="font-semibold text-slate-800">L:</span> {likelihoodLabel}
          </span>
          <span className="text-slate-300">·</span>
          <span className="text-[13px] text-slate-600">
            <span className="font-semibold text-slate-800">S:</span> {severityLabel}
          </span>
          <span className="text-slate-300">·</span>
          <span className="text-[13px] font-bold text-slate-800">Risk: {riskScore}</span>
        </div>

        {/* ── EXPAND / COLLAPSE TOGGLE ── */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 text-[12px] font-semibold text-primary hover:text-primary/80 transition-colors w-full"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Hide controls &amp; actions
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              {[item.existing_controls, item.additional_actions].filter(Boolean).length > 0
                ? 'Show controls & actions'
                : 'No controls or actions recorded'}
            </>
          )}
        </button>

        {/* ── COLLAPSIBLE: CONTROLS + ACTIONS ── */}
        {expanded && (
          <div className="mt-3 space-y-2">
            {/* Controls in Place */}
            {item.existing_controls ? (
              <div className="rounded-xl bg-green-50 border border-green-200 px-3 py-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-green-700 mb-1">
                  ✓ Controls in Place
                </p>
                <p className="text-[13px] text-green-900 leading-snug">{item.existing_controls}</p>
              </div>
            ) : (
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Controls in Place</p>
                <p className="text-[13px] text-slate-400 italic">None recorded</p>
              </div>
            )}

            {/* Further Actions */}
            {item.additional_actions ? (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 mb-1">
                  ⚡ Further Actions Required
                </p>
                <p className="text-[13px] text-amber-900 leading-snug">{item.additional_actions}</p>
              </div>
            ) : (
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Further Actions</p>
                <p className="text-[13px] text-slate-400 italic">None required</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
