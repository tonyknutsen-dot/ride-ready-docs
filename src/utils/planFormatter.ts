export const formatPlanName = (plan: string | null | undefined): string => {
  switch (plan) {
    case 'trial':
      return 'Trial';
    case 'basic':
      return 'Documents & Compliance';
    case 'advanced':
      return 'Operations & Maintenance';
    default:
      return 'Trial';
  }
};

export const formatPlanWithDescription = (plan: string | null | undefined): string => {
  switch (plan) {
    case 'trial':
      return 'Trial';
    case 'basic':
      return 'Documents & Compliance';
    case 'advanced':
      return 'Operations & Maintenance';
    default:
      return 'Trial';
  }
};

export const getPlanDescription = (plan: string | null | undefined): string => {
  switch (plan) {
    case 'trial':
      return 'Documents & Compliance';
    case 'basic':
      return 'Documents & Compliance';
    case 'advanced':
      return 'Operations & Maintenance';
    default:
      return 'Documents & Compliance';
  }
};
