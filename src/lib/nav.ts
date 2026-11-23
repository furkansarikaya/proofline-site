// Navigation and outbound links (TASK-005, ADR 0002 point 8, ADR 0006 point 3, ADR 0011): the menu entries, the pages that load the controls script,
// the two repository addresses and the pinned LICENSE address. Header.astro, Footer.astro and Base.astro read this one file.
// Erasable TypeScript only, relative imports spelled with `.ts`, so Vite (the Astro build) and Node type stripping (`node --test`) load it.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Lang } from './meta.ts';
import { index } from './translations.ts';
import type { Pair } from './translations.ts';

export interface MenuEntry {
  readonly en: string;
  readonly tr: string;
  readonly label: Readonly<Record<Lang, string>>;
  /** `site`: the page loads the controls script; `docs`: it loads docs.js instead (DESIGN.md rule 9). */
  readonly surface: 'site' | 'docs';
}

/** The five entries in the order of ADR 0002 point 8, with the addresses of its address table and the labels of TASK-005. */
export const MENU: readonly MenuEntry[] = [
  { en: '/', tr: '/tr/', label: { en: 'Home', tr: 'Ana sayfa' }, surface: 'site' },
  { en: '/get-started/', tr: '/tr/baslarken/', label: { en: 'Get started', tr: 'Başlarken' }, surface: 'site' },
  { en: '/docs/', tr: '/tr/docs/', label: { en: 'Docs', tr: 'Belgeler' }, surface: 'docs' },
  { en: '/trust/', tr: '/tr/guven/', label: { en: 'Trust', tr: 'Güven' }, surface: 'site' },
  { en: '/claude-code-and-codex/', tr: '/tr/claude-code-ve-codex/', label: { en: 'Claude Code + Codex', tr: 'Claude Code ve Codex' }, surface: 'site' },
];

export const REPO_URL = 'https://github.com/furkansarikaya/proofline';
export const SITE_REPO_URL = 'https://github.com/furkansarikaya/proofline-site';

/**
 * The entries of the language, in the fixed order, for the pages that exist. A page pair is registered in the translation index only when both
 * pages are built (ADR 0011), so registration is existence: no entry can link to an address that is missing from the build.
 */
export function menu(lang: Lang, pairs: readonly Pair[] = index.pairs): readonly { href: string; label: string }[] {
  return MENU.filter((entry) => pairs.some((pair) => pair.en === entry.en && pair.tr === entry.tr)).map((entry) => ({ href: entry[lang], label: entry.label[lang] }));
}

/** True for the addresses of the site pages (both languages): only they load /assets/controls.js. The 404 page and the docs pages do not (ADR 0008 point 4). */
export function controlsScript(page: string): boolean {
  return MENU.some((entry) => entry.surface === 'site' && (entry.en === page || entry.tr === page));
}

const COMMIT = /^[0-9a-f]{40}$/;

/** The commit of sync/pin.json under `root`; null when the file does not exist; a malformed commit throws (the sync step would fail first). */
export function pinnedCommit(root: string = process.cwd()): string | null {
  const file = join(root, 'sync', 'pin.json');
  if (!existsSync(file)) return null;
  let commit: unknown;
  try {
    commit = JSON.parse(readFileSync(file, 'utf8')).commit;
  } catch {
    throw new Error('sync/pin.json: not readable JSON');
  }
  if (typeof commit !== 'string' || !COMMIT.test(commit)) throw new Error('sync/pin.json: commit must be 40 lower-case hex characters');
  return commit;
}

/** The LICENSE address at the pinned commit, or on the `main` branch while the pin does not exist. */
export function licenseHref(commit: string | null): string {
  return `${REPO_URL}/blob/${commit ?? 'main'}/LICENSE`;
}
