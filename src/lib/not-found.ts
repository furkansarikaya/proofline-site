// The texts and the links of the one not-found page (TASK-024, ADR 0002): an English block and a Turkish block on `/404.html`, each with a link to the home page of its language and, once
// the docs exist, to the docs index of its language. The page file src/pages/404.astro renders these; the pair rule is the one of the header menu (src/lib/nav.ts): registration is existence.
// Erasable TypeScript only, relative imports spelled with `.ts`, so Vite (the Astro build) and Node type stripping (`node --test`) load this one file.
import { HOME } from './meta.ts';
import type { Lang } from './meta.ts';
import { index } from './translations.ts';
import type { Pair } from './translations.ts';

/** The pair of the two docs indexes (ADR 0002 point 8); the docs links of the page appear when this pair is registered in the translation index. */
export const DOCS_PAIR: Pair = { en: '/docs/', tr: '/tr/docs/' };

export interface NotFoundText {
  readonly heading: string;
  readonly sentence: string;
  readonly home: string;
  readonly docs: string;
}

/** The copy of the two blocks. Turkish letters are kept. The English sentence is also the lead of the page head (the description). */
export const NOT_FOUND_TEXT: Readonly<Record<Lang, NotFoundText>> = {
  en: { heading: 'Page not found', sentence: 'This address does not exist.', home: 'Home', docs: 'Docs' },
  tr: { heading: 'Sayfa bulunamadı', sentence: 'Bu adres mevcut değil.', home: 'Ana sayfa', docs: 'Belgeler' },
};

export interface NotFoundLink {
  readonly href: string;
  readonly label: string;
}

/**
 * The links of each block, home first. The home link is always listed; the docs link only when `pairs` holds the pair of both docs addresses, because a link to a page that
 * is not built fails the link check of the build (`pairs` is the registered pairs of the translation index by default).
 */
export function notFoundLinks(pairs: readonly Pair[] = index.pairs): Readonly<Record<Lang, readonly NotFoundLink[]>> {
  const docs = pairs.some((pair) => pair.en === DOCS_PAIR.en && pair.tr === DOCS_PAIR.tr);
  const links = (lang: Lang): NotFoundLink[] => [
    { href: HOME[lang], label: NOT_FOUND_TEXT[lang].home },
    ...(docs ? [{ href: DOCS_PAIR[lang], label: NOT_FOUND_TEXT[lang].docs }] : []),
  ];
  return { en: links('en'), tr: links('tr') };
}
