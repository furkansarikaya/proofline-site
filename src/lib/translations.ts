// The one translation index (TASK-004, ADR 0002 points 3 and 4): the pairs of English and Turkish pages, the hreflang alternates, the language
// switcher target and the staleness check of Turkish pages. The head tags (Base.astro), the language switcher (TASK-005) and the sitemap
// (TASK-006) all read this one object, so they can never disagree. Erasable TypeScript only, relative imports spelled with `.ts`.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { absoluteUrl, warn } from './meta.ts';
import type { Lang } from './meta.ts';

export interface Pair { readonly en: string; readonly tr: string }

/** One entry per translated page pair, addresses with the trailing slash. Every page task appends its own entry; the home pair is the first. */
export const PAIRS: readonly Pair[] = [{ en: '/', tr: '/tr/' }, { en: '/get-started/', tr: '/tr/baslarken/' }, { en: '/claude-code-and-codex/', tr: '/tr/claude-code-ve-codex/' }];

/** Where site-written content files live: English `<root>/en/<name>.md`, Turkish `<root>/tr/<name>.md` (the stamp script reads these). */
export const CONTENT_ROOT = 'src/content/pages';

export interface Alternate { readonly hreflang: 'en' | 'tr' | 'x-default'; readonly href: string }
export interface SwitcherTarget { readonly href: string; readonly lang: Lang; readonly translated: boolean }
export interface TranslationIndex {
  readonly pairs: readonly Pair[];
  alternates(page: string): Alternate[];
  switcherTarget(page: string): SwitcherTarget;
}

/** The language of an address: Turkish only under `/tr/`. */
export function langOf(page: string): Lang {
  if (!page.startsWith('/')) throw new Error(`address must start with "/": ${page}`);
  return page === '/tr/' || page.startsWith('/tr/') ? 'tr' : 'en';
}

/** Builds an index and checks every pair at once, so a bad entry fails the build or the test naming the address. */
export function createIndex(pairs: readonly Pair[]): TranslationIndex {
  const seen = new Set<string>();
  for (const pair of pairs) {
    for (const address of [pair.en, pair.tr]) {
      if (!address.startsWith('/') || !address.endsWith('/')) throw new Error(`translation index: address "${address}" must start and end with "/"`);
      if (seen.has(address)) throw new Error(`translation index: address "${address}" appears in more than one pair`);
      seen.add(address);
    }
    if (langOf(pair.en) !== 'en') throw new Error(`translation index: English address "${pair.en}" is under /tr/`);
    if (langOf(pair.tr) !== 'tr') throw new Error(`translation index: Turkish address "${pair.tr}" is not under /tr/`);
  }
  const byAddress = new Map<string, Pair>();
  for (const pair of pairs) {
    byAddress.set(pair.en, pair);
    byAddress.set(pair.tr, pair);
  }
  return {
    pairs,
    alternates(page: string): Alternate[] {
      const pair = byAddress.get(page);
      if (!pair) return [];
      return [
        { hreflang: 'en', href: absoluteUrl(pair.en) },
        { hreflang: 'tr', href: absoluteUrl(pair.tr) },
        { hreflang: 'x-default', href: absoluteUrl(pair.en) },
      ];
    },
    switcherTarget(page: string): SwitcherTarget {
      const pair = byAddress.get(page);
      if (pair) {
        const lang = langOf(page);
        return lang === 'en' ? { href: pair.tr, lang: 'tr', translated: true } : { href: pair.en, lang: 'en', translated: true };
      }
      // No Turkish (or English) version: land on the docs index of the other language for a docs page, on its home page otherwise.
      if (langOf(page) === 'en') return { href: page.startsWith('/docs/') ? '/tr/docs/' : '/tr/', lang: 'tr', translated: false };
      return { href: page.startsWith('/tr/docs/') ? '/docs/' : '/', lang: 'en', translated: false };
    },
  };
}

export const index: TranslationIndex = createIndex(PAIRS);

export function alternates(page: string): Alternate[] {
  return index.alternates(page);
}

export function switcherTarget(page: string): SwitcherTarget {
  return index.switcherTarget(page);
}

/** The sha256 (hex) of a content file with LF line ends, trimmed: line ends and outer white space never make a page stale. */
export function contentHash(text: string): string {
  return createHash('sha256').update(text.replace(/\r\n/g, '\n').trim(), 'utf8').digest('hex');
}

export type StaleSource =
  | { readonly kind: 'guide'; readonly recordedBlob: string; readonly englishBlob: string }
  | { readonly kind: 'site'; readonly translatedFrom: { readonly page: string; readonly hash: string } };

const BLOB = /^[0-9a-f]{40}$/;

/** True when the English source changed after the Turkish page was written. A broken pair (bad blob id, missing file) throws, it is never "stale". */
export function isStale(source: StaleSource, options: { root?: string } = {}): boolean {
  if (source.kind === 'guide') {
    if (!BLOB.test(source.recordedBlob) || !BLOB.test(source.englishBlob)) throw new Error('a blob id must be 40 lower-case hex characters');
    return source.recordedBlob !== source.englishBlob;
  }
  const text = readFileSync(join(options.root ?? process.cwd(), source.translatedFrom.page), 'utf8');
  return contentHash(text) !== source.translatedFrom.hash;
}

/** `isStale` plus the build warning. The message and the return value hold no blob id or hash, so none reaches a page. */
export function checkStale(
  page: string,
  source: StaleSource,
  options: { root?: string; warn?: (message: string) => void } = {},
): boolean {
  let stale: boolean;
  try {
    stale = isStale(source, options.root === undefined ? {} : { root: options.root });
  } catch (error) {
    throw new Error(`${page}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (stale) (options.warn ?? warn)(`${page}: the English source changed since this translation`);
  return stale;
}
