/**
 * The install matrix — one source of truth for "where do I paste it" per
 * platform. Used by /fix (fingerprint → one card) and /install (all cards).
 * Rules: exact admin click-paths, the required plan tier stated BEFORE the
 * steps, no pretending (Substack is an honest dead-end).
 */

export type Platform = {
  key: string;
  name: string;
  path: string[];
  tier?: string;
  note?: string;
};

export const SNIPPET = '<script src="https://typeset.us/go.js" defer></script>';

export const PLATFORMS: Record<string, Platform> = {
  ghost: {
    key: 'ghost',
    name: 'Ghost',
    path: ['Settings', 'Code injection', 'Site Header — paste, save'],
    tier: 'Works on every Ghost plan.',
    note: 'Ghost publishers chose their CMS for the reading experience. This is the missing half.',
  },
  wordpress: {
    key: 'wordpress',
    name: 'WordPress',
    path: ['Install a header-snippet plugin (WPCode is fine)', 'Code Snippets → Header', 'paste, save'],
    tier: 'Works on self-hosted WordPress and WordPress.com Business.',
    note: 'A one-toggle plugin is coming; the snippet works today.',
  },
  webflow: {
    key: 'webflow',
    name: 'Webflow',
    path: ['Site settings', 'Custom code', 'Head code — paste, save, publish'],
    tier: 'Needs any paid site plan (custom code is off on free staging).',
  },
  squarespace: {
    key: 'squarespace',
    name: 'Squarespace',
    path: ['Settings', 'Advanced', 'Code Injection → Header — paste, save'],
    tier: 'Needs the Business plan or higher.',
  },
  framer: {
    key: 'framer',
    name: 'Framer',
    path: ['Site Settings', 'General', 'Custom Code → Start of head — paste, publish'],
    tier: 'Needs any paid site plan.',
  },
  wix: {
    key: 'wix',
    name: 'Wix',
    path: ['Settings', 'Custom code', 'Add code to Head — paste, apply'],
    tier: 'Needs a Premium plan with a connected domain.',
  },
  shopify: {
    key: 'shopify',
    name: 'Shopify',
    path: ['Online Store', 'Themes → Edit code', 'theme.liquid — paste before </head>'],
    tier: 'Works on every Shopify plan.',
  },
  gtm: {
    key: 'gtm',
    name: 'Google Tag Manager',
    path: ['New Tag → Custom HTML', 'paste the snippet', 'Trigger: All Pages — publish'],
    tier: 'Works wherever GTM is already installed.',
    note: 'Slightly later than a head tag (GTM loads first), still self-verifying.',
  },
  unknown: {
    key: 'unknown',
    name: 'your site',
    path: ['Paste this one line before </head> in your page template'],
  },
};

/** Platforms that get their own /install/<key> page (Ghost first, on purpose). */
export const INSTALL_ORDER = ['ghost', 'webflow', 'framer', 'squarespace', 'wordpress', 'shopify', 'wix', 'gtm'] as const;

export function detectPlatform(html: string, url: string): Platform | 'substack' {
  const host = (() => {
    try { return new URL(url).hostname; } catch { return ''; }
  })();
  if (host.endsWith('substack.com') || html.includes('substackcdn.com')) return 'substack';
  const gen = (html.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)/i)?.[1] || '').toLowerCase();
  if (gen.includes('ghost')) return PLATFORMS.ghost;
  if (gen.includes('wordpress')) return PLATFORMS.wordpress;
  if (gen.includes('squarespace') || html.includes('static1.squarespace.com')) return PLATFORMS.squarespace;
  if (/data-wf-site/.test(html)) return PLATFORMS.webflow;
  if (html.includes('framerusercontent.com')) return PLATFORMS.framer;
  if (html.includes('wixstatic.com') || html.includes('parastorage.com')) return PLATFORMS.wix;
  if (html.includes('cdn.shopify.com')) return PLATFORMS.shopify;
  return PLATFORMS.unknown;
}
