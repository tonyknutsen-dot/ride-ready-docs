// Shared email template styles and components for Ride Ready Docs
// Brand colors: Primary blue #1e4a8f, Accent gold #f59e0b

// Logo hosted in Supabase storage for email compatibility
export const LOGO_URL = 'https://sbtldudgiskqfqqkrmaa.supabase.co/storage/v1/object/public/email-assets/app%20-%20logo.jpeg?v=1';

export const brandColors = {
  primary: '#1e4a8f',
  primaryLight: '#2563eb',
  accent: '#f59e0b',
  accentLight: '#fbbf24',
  success: '#16a34a',
  warning: '#f59e0b',
  danger: '#dc2626',
  text: '#1f2937',
  textLight: '#6b7280',
  background: '#f9fafb',
  white: '#ffffff',
  border: '#e5e7eb',
};

export const emailStyles = {
  body: `
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    line-height: 1.6;
    color: ${brandColors.text};
    margin: 0;
    padding: 0;
    background-color: ${brandColors.background};
  `,
  container: `
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
  `,
  header: `
    background: linear-gradient(135deg, ${brandColors.primary} 0%, ${brandColors.primaryLight} 100%);
    padding: 30px 40px;
    border-radius: 12px 12px 0 0;
    text-align: center;
  `,
  headerTitle: `
    color: white;
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.5px;
  `,
  headerSubtitle: `
    color: rgba(255, 255, 255, 0.9);
    margin: 8px 0 0 0;
    font-size: 14px;
    font-weight: 400;
  `,
  content: `
    background: ${brandColors.white};
    padding: 40px;
    border: 1px solid ${brandColors.border};
    border-top: none;
  `,
  footer: `
    background: ${brandColors.background};
    padding: 30px 40px;
    border: 1px solid ${brandColors.border};
    border-top: none;
    border-radius: 0 0 12px 12px;
    text-align: center;
  `,
  footerText: `
    color: ${brandColors.textLight};
    font-size: 12px;
    margin: 0;
    line-height: 1.8;
  `,
  footerLink: `
    color: ${brandColors.primary};
    text-decoration: none;
  `,
  button: `
    display: inline-block;
    background: linear-gradient(135deg, ${brandColors.primary} 0%, ${brandColors.primaryLight} 100%);
    color: white;
    padding: 14px 32px;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 600;
    font-size: 14px;
    text-align: center;
    margin: 20px 0;
  `,
  card: `
    background: ${brandColors.background};
    border: 1px solid ${brandColors.border};
    border-radius: 8px;
    padding: 20px;
    margin: 20px 0;
  `,
  infoBox: `
    background: #eff6ff;
    border-left: 4px solid ${brandColors.primary};
    padding: 16px 20px;
    border-radius: 0 8px 8px 0;
    margin: 20px 0;
  `,
  warningBox: `
    background: #fffbeb;
    border-left: 4px solid ${brandColors.accent};
    padding: 16px 20px;
    border-radius: 0 8px 8px 0;
    margin: 20px 0;
  `,
  successBox: `
    background: #f0fdf4;
    border-left: 4px solid ${brandColors.success};
    padding: 16px 20px;
    border-radius: 0 8px 8px 0;
    margin: 20px 0;
  `,
  dangerBox: `
    background: #fef2f2;
    border-left: 4px solid ${brandColors.danger};
    padding: 16px 20px;
    border-radius: 0 8px 8px 0;
    margin: 20px 0;
  `,
  divider: `
    border: none;
    border-top: 1px solid ${brandColors.border};
    margin: 30px 0;
  `,
  label: `
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: ${brandColors.textLight};
    margin-bottom: 4px;
  `,
  value: `
    font-size: 15px;
    color: ${brandColors.text};
    margin: 0;
  `,
};

// Logo as HTML img tag for better email client compatibility
export const logoHtml = `
  <img 
    src="${LOGO_URL}" 
    alt="Ride Ready Docs" 
    width="80" 
    height="80" 
    style="width: 80px; height: 80px; border-radius: 50%; margin-bottom: 16px;"
  />
`;

// Legacy SVG logo (kept for fallback)
export const logoSvg = `
<svg width="180" height="40" viewBox="0 0 180 40" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e4a8f"/>
      <stop offset="100%" style="stop-color:#2563eb"/>
    </linearGradient>
  </defs>
  <circle cx="20" cy="20" r="18" fill="url(#logoGradient)"/>
  <path d="M12 20 L18 26 L28 14" stroke="white" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="48" y="26" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#1e4a8f">Ride Ready</text>
  <text x="147" y="26" font-family="Arial, sans-serif" font-size="18" font-weight="400" fill="#f59e0b">Docs</text>
</svg>
`;

export function generateEmailWrapper(title: string, subtitle: string, content: string, showLogo: boolean = true): string {
  const currentYear = new Date().getFullYear();
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
</head>
<body style="${emailStyles.body}">
  <div style="${emailStyles.container}">
    <!-- Header -->
    <div style="${emailStyles.header}">
      ${showLogo ? logoHtml : ''}
      <h1 style="${emailStyles.headerTitle}">${title}</h1>
      ${subtitle ? `<p style="${emailStyles.headerSubtitle}">${subtitle}</p>` : ''}
    </div>
    
    <!-- Content -->
    <div style="${emailStyles.content}">
      ${content}
    </div>
    
    <!-- Footer -->
    <div style="${emailStyles.footer}">
      <p style="${emailStyles.footerText}">
        © ${currentYear} Ride Ready Docs. All rights reserved.<br>
        Professional compliance management for amusement equipment.<br><br>
        <a href="https://ridereadydocs.com" style="${emailStyles.footerLink}">ridereadydocs.com</a> · 
        <a href="mailto:info@ridereadydocs.com" style="${emailStyles.footerLink}">info@ridereadydocs.com</a>
      </p>
    </div>
  </div>
</body>
</html>
`;
}

export function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

export function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
