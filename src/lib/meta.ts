// Page head builders (TASK-004, ADR 0002 points 5 and 7): origin, name and phrase, titles, descriptions, the JSON-LD block.
// Erasable TypeScript only (no enum, namespace or parameter properties) and relative imports spelled with `.ts`, so Vite (the Astro build)
// and Node type stripping (`node --test`, the stamp script) load this one file. This module imports nothing from `src/`.

export type Lang = 'en' | 'tr';

export const ORIGIN = 'https://proofline.technology';
export const NAME = 'proofline';
export const PHRASE: Readonly<Record<Lang, string>> = {
  en: 'a deterministic engineering team for Claude Code and Codex',
  tr: 'Claude Code ve Codex için deterministik bir mühendislik ekibi',
};
export const HOME: Readonly<Record<Lang, string>> = { en: '/', tr: '/tr/' };

export const SITE_TITLE_MAX = 40;
export const TITLE_MAX = 120;
export const DESCRIPTION_MIN = 70;
export const DESCRIPTION_MAX = 160;

/** The name with the descriptive phrase of the language: the home title, the JSON-LD name and the image alternative text. */
export function brand(lang: Lang): string {
  return `${NAME}: ${PHRASE[lang]}`;
}

/** An absolute address on the site origin; `path` starts with a slash. */
export function absoluteUrl(path: string): string {
  if (!path.startsWith('/')) throw new Error(`address must start with "/": ${path}`);
  return ORIGIN + path;
}

export const OG_IMAGE = absoluteUrl('/og-default.png');

/** Length in code points: every cap of this module counts this. */
export function charCount(text: string): number {
  return Array.from(text).length;
}

/** The one warning sink of the build: a line on stderr, the build still exits 0. */
export function warn(message: string): void {
  console.warn('[proofline] warning: ' + message);
}

export type PageTitle = { kind: 'home' } | { kind: 'site'; text: string } | { kind: 'synced'; h1: string };

/** The title element of a page. A thrown error fails the build and names the page; no branch returns the name without the phrase. */
export function buildTitle(page: string, lang: Lang, title: PageTitle, onWarn: (message: string) => void = warn): string {
  if (title.kind === 'home') {
    if (page !== HOME[lang]) throw new Error(`${page}: only the home page "${HOME[lang]}" uses the home title`);
    return brand(lang);
  }
  if (title.kind === 'site') {
    if (page === HOME[lang]) throw new Error(`${page}: the home page title is the name and phrase only`);
    if (title.text.trim() === '') throw new Error(`${page}: site-written page title is empty`);
    const length = charCount(title.text);
    if (length > SITE_TITLE_MAX) {
      throw new Error(`${page}: site-written page title is ${length} characters, the limit is ${SITE_TITLE_MAX}`);
    }
    return `${title.text} | ${brand(lang)}`;
  }
  if (title.h1.trim() === '') throw new Error(`${page}: synced page heading is empty`);
  const result = `${title.h1} | ${brand(lang)}`;
  const length = charCount(result);
  if (length > TITLE_MAX) onWarn(`${page}: title is ${length} characters, above ${TITLE_MAX}`);
  return result;
}

/** The meta description: the lead cut at a word boundary (with "…" only when cut), then the name and phrase. */
export function buildDescription(page: string, lang: Lang, lead: string): string {
  const normalized = lead.replace(/\s+/g, ' ').trim();
  if (normalized === '') throw new Error(`${page}: the description lead is empty`);
  const suffix = ` ${brand(lang)}.`;
  const room = DESCRIPTION_MAX - charCount(suffix);
  const points = Array.from(normalized);
  let part = normalized;
  if (points.length > room) {
    const head = points.slice(0, room - 1);
    let cut = head;
    if (points[room - 1] !== ' ') {
      const space = head.lastIndexOf(' ');
      // shortcut: a lead with no space inside the room keeps the hard cut; improve when a lead is one long word
      if (space > 0) cut = head.slice(0, space);
    }
    part = cut.join('').trimEnd() + '…';
  }
  const description = part + suffix;
  const length = charCount(description);
  if (length < DESCRIPTION_MIN || length > DESCRIPTION_MAX) {
    throw new Error(`${page}: description is ${length} characters, expected ${DESCRIPTION_MIN} to ${DESCRIPTION_MAX}`);
  }
  return description;
}

/** The schema.org WebSite block of a home page; `<` is escaped so the text can never close its script element. */
export function websiteJsonLd(page: string, lang: Lang): string {
  const json = JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebSite', name: brand(lang), url: absoluteUrl(page) });
  return json.replace(/</g, '\\u003c');
}

export interface HeadMeta {
  title: string;
  description: string;
  ogImage: string;
  ogImageAlt: string;
  jsonLd: string | null;
}

/** Every value the head prints, built once: `og:title` and `og:description` print these same strings. */
export function buildHead(
  input: { page: string; lang: Lang; title: PageTitle; lead: string },
  onWarn: (message: string) => void = warn,
): HeadMeta {
  const { page, lang } = input;
  return {
    title: buildTitle(page, lang, input.title, onWarn),
    description: buildDescription(page, lang, input.lead),
    ogImage: OG_IMAGE,
    ogImageAlt: brand(lang),
    jsonLd: page === HOME[lang] ? websiteJsonLd(page, lang) : null,
  };
}
