// Shared email template styles and components for Ride Ready Docs
// Brand colors: Primary blue #1e4a8f, Accent gold #f59e0b

// Logo hosted in Supabase storage for email compatibility
export const LOGO_URL = 'https://sbtldudgiskqfqqkrmaa.supabase.co/storage/v1/object/public/email-assets/app-logo.jpg?v=1';

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
  textMuted: '#9ca3af',
  background: '#f3f4f6',
  white: '#ffffff',
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
};

export const emailStyles = {
  body: `
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    line-height: 1.6;
    color: ${brandColors.text};
    margin: 0;
    padding: 0;
    background-color: ${brandColors.background};
    -webkit-text-size-adjust: 100%;
  `,
  outerWrap: `
    width: 100%;
    background-color: ${brandColors.background};
    padding: 24px 0;
  `,
  container: `
    max-width: 560px;
    margin: 0 auto;
    background-color: ${brandColors.white};
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04);
  `,
  header: `
    background: linear-gradient(135deg, ${brandColors.primary} 0%, ${brandColors.primaryLight} 100%);
    padding: 14px 32px;
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
    padding: 32px 32px 28px;
  `,
  footer: `
    padding: 14px 32px 16px;
    border-top: 1px solid ${brandColors.border};
    text-align: center;
  `,
  footerText: `
    color: ${brandColors.textMuted};
    font-size: 11px;
    margin: 0;
    line-height: 1.5;
  `,
  footerLink: `
    color: ${brandColors.textLight};
    text-decoration: underline;
  `,
  button: `
    display: inline-block;
    background: linear-gradient(135deg, ${brandColors.primary} 0%, ${brandColors.primaryLight} 100%);
    color: #ffffff;
    padding: 12px 28px;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 600;
    font-size: 14px;
    text-align: center;
    mso-padding-alt: 12px 28px;
  `,
  card: `
    background: ${brandColors.borderLight};
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
    margin: 24px 0;
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

// Logo as HTML img tag — compact for header
export const logoHtml = `
  <img 
    src="${LOGO_URL}" 
    alt="Ride Ready Docs" 
    width="36" 
    height="36" 
    style="width: 36px; height: 36px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.25);"
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

/**
 * Build a complete branded marketing email HTML wrapper.
 * Content should already be HTML (use textToHtml for plain text).
 */
export function buildMarketingEmail(opts: {
  subject: string;
  bodyHtml: string;
  footerCompany?: string;
  unsubscribeUrl?: string;
}): string {
  const { subject, bodyHtml, footerCompany, unsubscribeUrl } = opts;
  const currentYear = new Date().getFullYear();
  const companyLine = footerCompany ? `Sent by ${escapeHtml(footerCompany)} · ` : '';
  const unsubLink = unsubscribeUrl
    ? `<a href="${unsubscribeUrl}" style="${emailStyles.footerLink}">Unsubscribe</a>`
    : `<span style="color: ${brandColors.textMuted};">Unsubscribe</span>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(subject)}</title>
  <!--[if mso]>
  <style>table,td{font-family:Arial,sans-serif;}</style>
  <![endif]-->
</head>
<body style="${emailStyles.body}">
  <div style="${emailStyles.outerWrap}">
    <div style="${emailStyles.container}">
      <!-- Header -->
      <div style="${emailStyles.header}">
        ${logoHtml}
      </div>
      
      <!-- Content -->
      <div style="${emailStyles.content}">
        ${bodyHtml}
      </div>
      
      <!-- Footer -->
      <div style="${emailStyles.footer}">
        <p style="${emailStyles.footerText}">
          ${companyLine}&copy; ${currentYear} Ride Ready Docs<br>
          Professional compliance management for amusement equipment<br><br>
          <a href="https://ridereadydocs.com" style="${emailStyles.footerLink}">ridereadydocs.com</a> &middot; ${unsubLink}
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Build a CTA button block (table-based for email client compatibility).
 */
export function buildCtaButton(text: string, url: string): string {
  return `
    <div style="text-align: center; margin: 24px 0 8px;">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${url}" style="height:44px;v-text-anchor:middle;width:220px;" arcsize="18%" strokecolor="${brandColors.primary}" fillcolor="${brandColors.primary}">
      <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">${escapeHtml(text)}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <a href="${url}" style="${emailStyles.button}" target="_blank">${escapeHtml(text)}</a>
      <!--<![endif]-->
    </div>
  `;
}

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
  <div style="${emailStyles.outerWrap}">
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
          &copy; ${currentYear} Ride Ready Docs<br>
          Professional compliance management for amusement equipment<br><br>
          <a href="https://ridereadydocs.com" style="${emailStyles.footerLink}">ridereadydocs.com</a> &middot; 
          <a href="mailto:info@ridereadydocs.com" style="${emailStyles.footerLink}">info@ridereadydocs.com</a>
        </p>
      </div>
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
