export const formatPlanName = (plan: string | null | undefined): string => {
  switch (plan) {
    case 'trial':
      return 'Trial';
    case 'basic':
      return 'Basic Plan';
    case 'advanced':
      return 'Advanced Plan';
    default:
      return 'Trial';
  }
};

export const formatPlanWithDescription = (plan: string | null | undefined): string => {
  switch (plan) {
    case 'trial':
      return 'Trial (Documents)';
    case 'basic':
      return 'Basic Plan (Documents)';
    case 'advanced':
      return 'Advanced Plan (Operations & Maintenance)';
    default:
      return 'Trial';
  }
};

export const getPlanDescription = (plan: string | null | undefined): string => {
  switch (plan) {
    case 'trial':
      return 'Documents';
    case 'basic':
      return 'Documents';
    case 'advanced':
      return 'Operations & Maintenance';
    default:
      return 'Documents';
  }
};
