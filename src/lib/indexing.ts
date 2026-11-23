// The indexing switch (TASK-006, ADR 0005 point 6, ADR 0002 point 3): the one place that reads the four build variables and owns every output that
// depends on them: the mode, the canonical address, robots.txt, the sitemap text, the page list and the three build-log lines.
// Erasable TypeScript only and relative imports spelled with `.ts`, so Vite (the Astro build) and Node type stripping (`node --test`, the config) load
// this one file. Every address is built by `absoluteUrl` (the one origin literal lives in meta.ts) and every alternate by `alternates` (translations.ts).
import { absoluteUrl } from './meta.ts';
import { alternates } from './translations.ts';

/** The four environment variables of the build; the tests remove exactly these to get a closed build. */
export const ENV_KEYS = ['VERCEL_ENV', 'SITE_INDEXABLE', 'GOOGLE_SITE_VERIFICATION', 'BING_SITE_VERIFICATION'] as const;

/** The key of the not-found page: it gets no canonical link and no sitemap entry. */
export const NOT_FOUND = '/404.html';

export type Env = Readonly<Record<string, string | undefined>>;

export interface Verification {
  readonly console: 'google' | 'bing';
  readonly name: 'google-site-verification' | 'msvalidate.01';
  readonly content: string | null;
}

export interface Indexing {
  readonly indexable: boolean;
  readonly reason: string;
  readonly verification: readonly Verification[];
}

const CLOSED_REASON = 'VERCEL_ENV is not production and SITE_INDEXABLE is not 1';

/** Pure: decides from an environment object. Indexable only for `VERCEL_ENV=production` or `SITE_INDEXABLE=1` (exact text); anything else is closed. */
export function readIndexing(env: Env): Indexing {
  const production = env.VERCEL_ENV === 'production';
  const flagged = env.SITE_INDEXABLE === '1';
  const trimmed = (key: string): string | null => {
    const value = (env[key] ?? '').trim();
    return value === '' ? null : value;
  };
  return {
    indexable: production || flagged,
    reason: production ? 'VERCEL_ENV=production' : flagged ? 'SITE_INDEXABLE=1' : CLOSED_REASON,
    verification: [
      { console: 'google', name: 'google-site-verification', content: trimmed('GOOGLE_SITE_VERIFICATION') },
      { console: 'bing', name: 'msvalidate.01', content: trimmed('BING_SITE_VERIFICATION') },
    ],
  };
}

/** The one read of the process environment in the module. */
export const indexing: Indexing = readIndexing(process.env);

/** The three build-log lines. They read the mode, its reason and whether a value exists; a verification value is never printed. */
export function logLines(state: Indexing): string[] {
  return [
    `indexing: ${state.indexable ? 'allowed' : 'blocked'} (${state.reason})`,
    ...state.verification.map((v) => `verification tag: ${v.content === null ? 'absent' : 'present'} (${v.console})`),
  ];
}

/** The page's own address for `link rel="canonical"`; null in a closed build and for the not-found page. */
export function canonicalUrl(page: string, state: Indexing = indexing): string | null {
  if (!state.indexable || page === NOT_FOUND) return null;
  return absoluteUrl(page);
}

/** The text of robots.txt: closed disallows everything, indexable allows all and names the sitemap. */
export function robotsTxt(state: Indexing = indexing): string {
  if (!state.indexable) return 'User-agent: *\nDisallow: /\n';
  return `User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl('/sitemap.xml')}\n`;
}

/** Page addresses from `import.meta.glob` keys relative to `src/pages` (`./index.astro`, `./x/index.astro`, `./x.astro`): sorted, once each. */
export function pageAddresses(files: readonly string[]): string[] {
  const out = new Set<string>();
  for (const file of files) {
    const segments = file.replace(/^\.\//, '').replace(/\.astro$/, '').split('/');
    if (file === './404.astro' || segments.some((s) => s.startsWith('_'))) continue;
    if (file.includes('[')) throw new Error(`sitemap: dynamic route ${file} needs its addresses listed`);
    if (segments[segments.length - 1] === 'index') segments.pop();
    out.add(segments.length === 0 ? '/' : `/${segments.join('/')}/`);
  }
  return [...out].sort();
}

const escapeXml = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** The sitemap text: one `url` per page with its `xhtml:link` alternates from the translation index; no lastmod, so the build stays byte-stable. */
export function sitemapXml(pages: readonly string[]): string {
  const entries = pages.map((page) => {
    const links = alternates(page).map((a) => `    <xhtml:link rel="alternate" hreflang="${escapeXml(a.hreflang)}" href="${escapeXml(a.href)}"/>\n`);
    return `  <url>\n    <loc>${escapeXml(absoluteUrl(page))}</loc>\n${links.join('')}  </url>\n`;
  });
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
    + entries.join('')
    + '</urlset>\n';
}

/** The `meta` tag of one verification entry as markup, null when there is no value. The value is written with the five characters as entities (so the raw attribute holds no quote, angle bracket or lone ampersand); the layout prints it as is. */
export function verificationMeta(v: Verification): string | null {
  return v.content === null ? null : `<meta name="${v.name}" content="${escapeXml(v.content)}">`;
}
