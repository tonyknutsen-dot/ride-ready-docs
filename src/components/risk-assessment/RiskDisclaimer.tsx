import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Scale } from 'lucide-react';

interface RiskDisclaimerProps {
  variant?: 'compact' | 'full';
}

export function RiskDisclaimer({ variant = 'compact' }: RiskDisclaimerProps) {
  if (variant === 'compact') {
    return (
      <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 border border-muted">
        <div className="flex items-start gap-2">
          <Scale className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
          <div>
            <strong className="text-foreground">Professional Judgement Required:</strong>{' '}
            Calculated risk scores are guidance only. As the competent person completing this assessment, 
            you are responsible for determining if the values and controls are appropriate for your specific circumstances.
          </div>
        </div>
      </div>
    );
  }

  return (
    <Alert className="border-warning/50 bg-warning/5">
      <AlertTriangle className="h-4 w-4 text-warning" />
      <AlertTitle className="text-sm font-semibold">Important Disclaimer</AlertTitle>
      <AlertDescription className="text-xs space-y-2 mt-2">
        <p>
          The risk scores, reduction percentages, and calculations provided by this application are 
          <strong> guidance tools only</strong> and should not be relied upon as definitive assessments.
        </p>
        <p>
          As the person responsible for compiling this risk assessment, <strong>you must use your 
          professional judgement</strong> to determine whether the calculated values accurately reflect 
          the risks present in your specific operating environment.
        </p>
        <p>
          <strong>The operators of this application accept no liability</strong> for decisions made 
          based on these calculations. You should consider factors such as:
        </p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Site-specific conditions and hazards</li>
          <li>The actual effectiveness of your control measures</li>
          <li>Competence and training of personnel</li>
          <li>Environmental factors and operating conditions</li>
          <li>Relevant legislation, standards, and industry guidance</li>
        </ul>
        <p className="font-medium pt-1">
          Always verify that your risk assessment meets your legal obligations and is suitable 
          for the activities being assessed.
        </p>
      </AlertDescription>
    </Alert>
  );
}
