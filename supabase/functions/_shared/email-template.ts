// Shared email template styles and components for Ride Ready Docs
// Brand colors: Primary blue #1e4a8f, Accent gold #f59e0b
// Designed for Gmail / Outlook / Apple Mail with inline-style compatibility.

export const LOGO_URL = 'https://sbtldudgiskqfqqkrmaa.supabase.co/storage/v1/object/public/email-assets/app-logo.jpg?v=1';

export const brandColors = {
  primary: '#1e4a8f',
  primaryLight: '#2563eb',
  primaryDark: '#152f5f',
  accent: '#f59e0b',
  accentLight: '#fbbf24',
  success: '#16a34a',
  warning: '#f59e0b',
  danger: '#dc2626',
  text: '#111827',
  textLight: '#4b5563',
  textMuted: '#6b7280',
  background: '#f6f7f9',
  surface: '#ffffff',
  surfaceAlt: '#fafbfc',
  white: '#ffffff',
  border: '#e5e7eb',
  borderLight: '#eef0f3',
};

const fontStack = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`;

export const emailStyles = {
  body: `
    margin:0; padding:0;
    background-color:${brandColors.background};
    font-family:${fontStack};
    color:${brandColors.text};
    line-height:1.55;
    -webkit-text-size-adjust:100%;
    -ms-text-size-adjust:100%;
  `,
  outerWrap: `
    width:100%;
    background-color:${brandColors.background};
    padding:24px 12px;
  `,
  container: `
    max-width:600px;
    margin:0 auto;
    background-color:${brandColors.surface};
    border:1px solid ${brandColors.border};
    border-radius:8px;
    overflow:hidden;
  `,
  header: `
    background-color:${brandColors.primary};
    padding:18px 28px;
    border-bottom:3px solid ${brandColors.accent};
  `,
  headerTitle: `
    color:#ffffff;
    margin:0;
    font-family:${fontStack};
    font-size:18px;
    font-weight:600;
    letter-spacing:-0.2px;
    line-height:1.3;
  `,
  headerSubtitle: `
    color:rgba(255,255,255,0.82);
    margin:4px 0 0 0;
    font-family:${fontStack};
    font-size:13px;
    font-weight:400;
    line-height:1.4;
  `,
  content: `
    padding:24px 28px 8px 28px;
    font-family:${fontStack};
    color:${brandColors.text};
    font-size:15px;
    line-height:1.6;
  `,
  footer: `
    padding:18px 28px 20px 28px;
    background-color:${brandColors.surfaceAlt};
    border-top:1px solid ${brandColors.border};
    text-align:center;
  `,
  footerText: `
    color:${brandColors.textMuted};
    font-family:${fontStack};
    font-size:12px;
    line-height:1.6;
    margin:0;
  `,
  footerLink: `
    color:${brandColors.primary};
    text-decoration:none;
    font-weight:500;
  `,
  button: `
    display:inline-block;
    background-color:${brandColors.primary};
    color:#ffffff;
    padding:11px 24px;
    border-radius:6px;
    text-decoration:none;
    font-family:${fontStack};
    font-weight:600;
    font-size:14px;
    line-height:1;
    mso-padding-alt:11px 24px;
  `,
  card: `
    background:${brandColors.surfaceAlt};
    border:1px solid ${brandColors.border};
    border-radius:6px;
    padding:14px 16px;
    margin:14px 0;
    font-family:${fontStack};
    font-size:14px;
  `,
  infoBox: `
    background:${brandColors.surfaceAlt};
    border:1px solid ${brandColors.border};
    border-left:3px solid ${brandColors.primary};
    padding:12px 16px;
    border-radius:4px;
    margin:14px 0;
    font-family:${fontStack};
    font-size:14px;
  `,
  warningBox: `
    background:#fffbeb;
    border:1px solid #fde68a;
    border-left:3px solid ${brandColors.accent};
    padding:12px 16px;
    border-radius:4px;
    margin:14px 0;
    font-family:${fontStack};
    font-size:14px;
  `,
  successBox: `
    background:#f0fdf4;
    border:1px solid #bbf7d0;
    border-left:3px solid ${brandColors.success};
    padding:12px 16px;
    border-radius:4px;
    margin:14px 0;
    font-family:${fontStack};
    font-size:14px;
  `,
  dangerBox: `
    background:#fef2f2;
    border:1px solid #fecaca;
    border-left:3px solid ${brandColors.danger};
    padding:12px 16px;
    border-radius:4px;
    margin:14px 0;
    font-family:${fontStack};
    font-size:14px;
  `,
  divider: `
    border:none;
    border-top:1px solid ${brandColors.border};
    margin:20px 0;
  `,
  label: `
    font-family:${fontStack};
    font-size:11px;
    font-weight:700;
    text-transform:uppercase;
    letter-spacing:0.6px;
    color:${brandColors.textMuted};
    margin:0 0 6px 0;
  `,
  value: `
    font-family:${fontStack};
    font-size:14px;
    color:${brandColors.text};
    margin:2px 0;
    line-height:1.5;
  `,
};

// Compact typographic wordmark used in transactional headers — no remote image
// so emails always render reliably in Gmail/Outlook with images disabled.
export const logoHtml = `
  <div style="font-family:${fontStack}; font-size:11px; font-weight:700; letter-spacing:1.4px; text-transform:uppercase; color:rgba(255,255,255,0.85); margin:0 0 4px 0;">
    Ride Ready Docs
  </div>
`;

// Backwards-compatible alias for older imports
export const logoSvg = logoHtml;

// Marketing-only header (kept for marketing emails — not used by transactional)
export const brandHeaderHtml = `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
    <tr>
      <td style="text-align:center; vertical-align:middle;">
        <span style="font-family:${fontStack}; font-size:20px; font-weight:700; color:#ffffff; letter-spacing:-0.3px;">Ride Ready Docs</span>
      </td>
    </tr>
  </table>
`;

export const footerLogoHtml = ``;

/**
 * Build a complete branded marketing email HTML wrapper.
 */
export function buildMarketingEmail(opts: {
  subject: string;
  bodyHtml: string;
  footerCompany?: string;
  unsubscribeUrl?: string;
}): string {
  const { subject, bodyHtml, footerCompany, unsubscribeUrl } = opts;
  const currentYear = new Date().getFullYear();
  const companyLine = footerCompany ? `Sent by ${escapeHtml(footerCompany)} &middot; ` : '';
  const unsubLink = unsubscribeUrl
    ? `<a href="${unsubscribeUrl}" style="${emailStyles.footerLink}">Unsubscribe</a>`
    : `<span style="color:${brandColors.textMuted};">Unsubscribe</span>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="${emailStyles.body}">
  <div style="${emailStyles.outerWrap}">
    <div style="${emailStyles.container}">
      <div style="${emailStyles.header}">
        ${brandHeaderHtml}
      </div>
      <div style="${emailStyles.content}">
        ${bodyHtml}
      </div>
      <div style="${emailStyles.footer}">
        <p style="${emailStyles.footerText}">
          ${companyLine}&copy; ${currentYear} Ride Ready Docs<br>
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
    <div style="text-align:center; margin:22px 0 6px;">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${url}" style="height:42px;v-text-anchor:middle;width:220px;" arcsize="14%" strokecolor="${brandColors.primary}" fillcolor="${brandColors.primary}">
      <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">${escapeHtml(text)}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <a href="${url}" style="${emailStyles.button}" target="_blank">${escapeHtml(text)}</a>
      <!--<![endif]-->
    </div>
  `;
}

/**
 * Render a polished, table-based list of attached documents.
 * Used by transactional emails that ship a document package.
 */
export function buildDocumentTable(
  docs: Array<{ name: string; type?: string; expiresAt?: string; group?: string }>,
  label: string = 'Attached documents'
): string {
  if (!docs || docs.length === 0) return '';

  // Group by `group` (e.g. ride name) when provided.
  const groups: Record<string, typeof docs> = {};
  let hasGroups = false;
  for (const d of docs) {
    const key = d.group || '__none__';
    if (d.group) hasGroups = true;
    if (!groups[key]) groups[key] = [];
    groups[key].push(d);
  }

  const renderRow = (d: { name: string; type?: string; expiresAt?: string }) => `
    <tr>
      <td style="padding:10px 12px; border-bottom:1px solid ${brandColors.borderLight}; vertical-align:top; width:28px;">
        <span style="display:inline-block; width:22px; height:22px; border-radius:4px; background:${brandColors.primary}; color:#ffffff; font-family:${fontStack}; font-size:10px; font-weight:700; line-height:22px; text-align:center;">PDF</span>
      </td>
      <td style="padding:10px 12px 10px 4px; border-bottom:1px solid ${brandColors.borderLight}; vertical-align:top;">
        <div style="font-family:${fontStack}; font-size:14px; color:${brandColors.text}; font-weight:600; line-height:1.35;">${escapeHtml(d.name)}</div>
        ${d.type ? `<div style="font-family:${fontStack}; font-size:12px; color:${brandColors.textMuted}; margin-top:2px;">${escapeHtml(d.type)}</div>` : ''}
      </td>
      ${d.expiresAt ? `<td style="padding:10px 12px; border-bottom:1px solid ${brandColors.borderLight}; vertical-align:top; text-align:right; font-family:${fontStack}; font-size:12px; color:${brandColors.textMuted}; white-space:nowrap;">Expires<br><strong style="color:${brandColors.text};">${escapeHtml(d.expiresAt)}</strong></td>` : `<td style="padding:10px 12px; border-bottom:1px solid ${brandColors.borderLight};"></td>`}
    </tr>
  `;

  const sections = Object.entries(groups).map(([groupName, items]) => {
    const header = hasGroups && groupName !== '__none__'
      ? `<tr><td colspan="3" style="padding:10px 12px 8px 12px; background:${brandColors.surfaceAlt}; border-bottom:1px solid ${brandColors.border}; font-family:${fontStack}; font-size:12px; font-weight:700; letter-spacing:0.4px; text-transform:uppercase; color:${brandColors.primary};">${escapeHtml(groupName)}</td></tr>`
      : '';
    return header + items.map(renderRow).join('');
  }).join('');

  return `
    <div style="margin:20px 0;">
      <p style="${emailStyles.label}">${escapeHtml(label)}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse; border:1px solid ${brandColors.border}; border-radius:6px; overflow:hidden; background:${brandColors.surface};">
        ${sections}
      </table>
      <p style="font-family:${fontStack}; font-size:12px; color:${brandColors.textMuted}; margin:8px 0 0 0;">${docs.length} document${docs.length === 1 ? '' : 's'} attached</p>
    </div>
  `;
}

export function generateEmailWrapper(title: string, subtitle: string, content: string, _showLogo: boolean = true): string {
  const currentYear = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(title)}</title>
</head>
<body style="${emailStyles.body}">
  <div style="${emailStyles.outerWrap}">
    <div style="${emailStyles.container}">
      <div style="${emailStyles.header}">
        ${logoHtml}
        <h1 style="${emailStyles.headerTitle}">${title}</h1>
        ${subtitle ? `<p style="${emailStyles.headerSubtitle}">${subtitle}</p>` : ''}
      </div>
      <div style="${emailStyles.content}">
        ${content}
      </div>
      <div style="${emailStyles.footer}">
        <p style="${emailStyles.footerText}">
          <strong style="color:${brandColors.text}; font-size:13px;">Ride Ready Docs</strong><br>
          Compliance &amp; documentation management for amusement equipment<br>
          <a href="https://ridereadydocs.com" style="${emailStyles.footerLink}">ridereadydocs.com</a> &middot;
          <a href="mailto:info@ridereadydocs.com" style="${emailStyles.footerLink}">info@ridereadydocs.com</a><br>
          <span style="color:${brandColors.textMuted}; font-size:11px;">&copy; ${currentYear} Ride Ready Docs &middot; All rights reserved</span>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
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
