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
  /** Something the owner should know before pasting, shown above the steps. */
  warning?: string;
};

import { PINNED_SNIPPET } from './install-snippet';

/** The pinned loader with its integrity hash (from public/sri.json). */
export const SNIPPET = PINNED_SNIPPET;

/** React sites rendered on the server. From 4.4 the loader waits for
 * hydration on pages with a framework marker (Framer has one; Wix does not,
 * so its page asks for data-typeset-defer="hydration"). Neither has been
 * checked on a live site yet. */
const FRAMER_WARNING = 'Framer builds pages with React and renders them on the server. From 4.4 the script finds Framer\u2019s page marker and waits for React to take over in the browser before it sets any text, so React logs no hydration error and does not redraw the page. This has not yet been checked on a live Framer site: if an error monitor such as Sentry reports a hydration error (#418 or #425) after you install it, please report it.';
const WIX_WARNING = 'Wix builds pages with React and renders them on the server, and its pages carry no marker the script recognises. If the script sets text before React takes over in the browser, React logs a hydration error (#418 or #425) and redraws the page once; the final page is correct, but error monitors such as Sentry report it. With 4.4, add data-typeset-defer="hydration" inside the script tag, before defer, and the script waits for React first (at most 10 seconds). This has not yet been checked on a live Wix site.';

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
    warning: FRAMER_WARNING,
  },
  wix: {
    key: 'wix',
    name: 'Wix',
    path: ['Settings', 'Custom code', 'Add code to Head — paste, apply'],
    tier: 'Needs a Premium plan with a connected domain.',
    warning: WIX_WARNING,
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
