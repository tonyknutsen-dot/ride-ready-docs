import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Terminology {
  // Certificate names
  safetyCertificate: string;
  safetyCertificateShort: string;
  safetyCertificateDescription: string;
  inflatableCertificate: string;
  inflatableCertificateDescription: string;
  
  // Authority names
  localAuthority: string; // "council" in UK, "local authority" elsewhere
  inspector: string;
  
  // Operator names
  operator: string; // "showman" in UK, "operator" elsewhere
  operatorPlural: string;
  
  // Country info
  country: string;
  countryCode: string;
  isUK: boolean;
  
  // Helper text
  ukTerminologyNote: string;
}

const UK_TERMINOLOGY: Terminology = {
  safetyCertificate: 'Declaration of Compliance (DOC)',
  safetyCertificateShort: 'DOC Certificate',
  safetyCertificateDescription: 'ADIPS Declaration of Compliance - Required for UK operation',
  inflatableCertificate: 'PIPA Certificate',
  inflatableCertificateDescription: 'PIPA or ADIPS certificate for inflatable devices',
  
  localAuthority: 'council',
  inspector: 'ADIPS inspector',
  
  operator: 'showman',
  operatorPlural: 'showmen',
  
  country: 'United Kingdom',
  countryCode: 'GB',
  isUK: true,
  
  ukTerminologyNote: '',
};

const GLOBAL_TERMINOLOGY: Terminology = {
  safetyCertificate: 'Safety Compliance Certificate',
  safetyCertificateShort: 'Safety Certificate',
  safetyCertificateDescription: 'Annual safety inspection certificate for your equipment',
  inflatableCertificate: 'Inflatable Safety Certificate',
  inflatableCertificateDescription: 'Safety compliance certificate for inflatable devices',
  
  localAuthority: 'local authority',
  inspector: 'safety inspector',
  
  operator: 'operator',
  operatorPlural: 'operators',
  
  country: 'International',
  countryCode: 'OTHER',
  isUK: false,
  
  ukTerminologyNote: 'Known as DOC/ADIPS certificates in the UK',
};

const IRELAND_TERMINOLOGY: Terminology = {
  ...GLOBAL_TERMINOLOGY,
  country: 'Ireland',
  countryCode: 'IE',
  localAuthority: 'local authority',
  ukTerminologyNote: 'Similar to UK DOC certificates',
};

const AUSTRALIA_TERMINOLOGY: Terminology = {
  ...GLOBAL_TERMINOLOGY,
  country: 'Australia',
  countryCode: 'AU',
  localAuthority: 'council',
  ukTerminologyNote: '',
};

const GERMANY_TERMINOLOGY: Terminology = {
  ...GLOBAL_TERMINOLOGY,
  safetyCertificate: 'TÜV Safety Certificate',
  safetyCertificateShort: 'TÜV Certificate',
  safetyCertificateDescription: 'TÜV or equivalent safety certification',
  country: 'Germany',
  countryCode: 'DE',
  localAuthority: 'authority',
  inspector: 'TÜV inspector',
  ukTerminologyNote: '',
};

const TERMINOLOGY_MAP: Record<string, Terminology> = {
  'GB': UK_TERMINOLOGY,
  'IE': IRELAND_TERMINOLOGY,
  'AU': AUSTRALIA_TERMINOLOGY,
  'NZ': { ...AUSTRALIA_TERMINOLOGY, country: 'New Zealand', countryCode: 'NZ' },
  'DE': GERMANY_TERMINOLOGY,
  'US': { ...GLOBAL_TERMINOLOGY, country: 'United States', countryCode: 'US', localAuthority: 'authority' },
  'CA': { ...GLOBAL_TERMINOLOGY, country: 'Canada', countryCode: 'CA', localAuthority: 'authority' },
  'FR': { ...GLOBAL_TERMINOLOGY, country: 'France', countryCode: 'FR' },
  'NL': { ...GLOBAL_TERMINOLOGY, country: 'Netherlands', countryCode: 'NL' },
  'ES': { ...GLOBAL_TERMINOLOGY, country: 'Spain', countryCode: 'ES' },
  'IT': { ...GLOBAL_TERMINOLOGY, country: 'Italy', countryCode: 'IT' },
  'OTHER': GLOBAL_TERMINOLOGY,
};

export type OperatorType = 'showman' | 'private_operator' | 'company';

export function useTerminology() {
  const { user } = useAuth();
  const [terminology, setTerminology] = useState<Terminology>(GLOBAL_TERMINOLOGY);
  const [operatorType, setOperatorType] = useState<OperatorType>('company');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserPreferences = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('country, operator_type')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!error && data) {
          // Store operator type
          const userOperatorType = (data.operator_type as OperatorType) || 'company';
          setOperatorType(userOperatorType);
          
          // Start with country-based terminology
          let baseTerm = TERMINOLOGY_MAP[data.country || 'OTHER'] || GLOBAL_TERMINOLOGY;
          
          // Override operator terminology based on operator_type preference
          if (userOperatorType === 'showman') {
            // Use showman terminology regardless of country
            baseTerm = {
              ...baseTerm,
              operator: 'showman',
              operatorPlural: 'showmen',
              isUK: true, // For terminology purposes, treat as UK-style
            };
          } else if (userOperatorType === 'private_operator' || userOperatorType === 'company') {
            // Use operator/company terminology
            baseTerm = {
              ...baseTerm,
              operator: 'operator',
              operatorPlural: 'operators',
              isUK: baseTerm.countryCode === 'GB', // Keep actual country for other terms
            };
          }
          
          setTerminology(baseTerm);
        }
      } catch (error) {
        console.error('Error loading user preferences:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserPreferences();
  }, [user]);

  return { terminology, operatorType, loading };
}

// For use when user is not logged in (e.g., landing pages)
// Detects country from browser or defaults to international
export function useDetectedTerminology() {
  const [terminology, setTerminology] = useState<Terminology>(GLOBAL_TERMINOLOGY);

  useEffect(() => {
    // Try to detect country from browser
    const browserLang = navigator.language || 'en';
    
    if (browserLang.includes('en-GB') || browserLang.includes('en-UK')) {
      setTerminology(UK_TERMINOLOGY);
    } else if (browserLang.includes('en-AU')) {
      setTerminology(AUSTRALIA_TERMINOLOGY);
    } else if (browserLang.includes('de')) {
      setTerminology(GERMANY_TERMINOLOGY);
    } else if (browserLang.includes('en-IE')) {
      setTerminology(IRELAND_TERMINOLOGY);
    }
    // Otherwise keep global terminology
  }, []);

  return terminology;
}

export { UK_TERMINOLOGY, GLOBAL_TERMINOLOGY };
