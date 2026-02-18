import { Scale, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

interface RiskDisclaimerProps {
  variant?: 'compact' | 'full';
  showLink?: boolean;
}

export function RiskDisclaimer({ variant = 'compact', showLink = false }: RiskDisclaimerProps) {
  return (
    <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3">
      <div className="flex items-start gap-2.5">
        <Scale className="h-4 w-4 shrink-0 mt-0.5 text-[#2563EB]" />
        <div className="space-y-1">
          <p className="text-[13px] font-semibold text-[#1E3A8A]">Professional Judgement Required</p>
          <p className="text-[12px] text-[#1E40AF] leading-relaxed">
            Calculated risk scores are guidance only. As the competent person completing this assessment,
            you are responsible for determining if the values and controls are appropriate for your specific circumstances.
          </p>
          {showLink && (
            <Link
              to="/risk-assessments"
              className="inline-flex items-center gap-1 text-[12px] text-[#2563EB] hover:underline font-semibold mt-1"
            >
              <ExternalLink className="h-3 w-3" />
              View Risk Assessments
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
