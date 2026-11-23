// Helpers of the Claude Code and Codex page (TASK-023): the page addresses, the one command that uses both agents, the pin facts the page reads (with the page address in
// front of a missing-sentence error), and the check of the content files. The plugin lines and the installer lines are the ones of the get-started page (imported, never
// retyped); the both-agents command is a README inline span and is checked against `readme_inline_spans` before the page renders. The Codex limit sentence is never typed:
// it is `codex_sentence` of the pin facts (PRD FR-8, NFR-4). Erasable TypeScript only and relative imports spelled with `.ts` or `.mjs`, as get-started.ts does.
import { join } from 'node:path';
import { readPinFacts } from '../../scripts/lib/pin-facts.mjs';
import type { Lang } from './meta.ts';

/** The address of the page in each language (ADR 0002 point 1); the pair is registered in translations.ts. */
export const AGENTS_PAGE: Readonly<Record<Lang, string>> = { en: '/claude-code-and-codex/', tr: '/tr/claude-code-ve-codex/' };

/** The README inline span of the command that uses both agents: it runs the implementer role on Codex. It is shown as a marked inline element, never as a block line. */
export const BOTH_SPAN = 'proofline init --role implementer=codex';

/** The part of the pin facts this page reads. */
export interface AgentsFacts {
  readonly readme_commands: readonly string[];
  readonly readme_inline_spans: readonly string[];
  readonly codex_sentence: string;
}

/** The sentence of the error of the pin facts reader for a README sentence that is not found. */
const SENTENCE_MISSING = 'sentence not found in the section';

/**
 * The pin facts of the repository under `root`: sync/pin.json and the cached documents. A missing README sentence is rethrown with the page address in front of the
 * original message (which holds the pattern), so the failed build names the page; any other error is thrown as it is.
 */
export function agentsFacts(page: string, root: string = process.cwd()): AgentsFacts {
  try {
    return readPinFacts(join(root, 'sync', 'pin.json'), join(root, '.cache', 'sync'));
  } catch (error) {
    if (error instanceof Error && error.message.includes(SENTENCE_MISSING)) throw new Error(`${page}: ${error.message}`, { cause: error });
    throw error;
  }
}

export interface AgentsContent {
  readonly title: string;
  readonly lead: string;
  readonly claude: { readonly intro: string };
  readonly codex: { readonly intro: string };
  readonly both: { readonly heading: string; readonly before: string; readonly after: string };
  readonly start: { readonly intro: string; readonly link: string };
  /** `source` is the text of the link to the README Status section, in both languages; only the Turkish file adds the hand translation of the Codex sentence and the words that introduce the English original. */
  readonly limit: { readonly source: string; readonly original?: string; readonly translation?: string };
}

/** The keys of the content file of every language. */
export const TEXT_KEYS: readonly string[] = ['title', 'lead', 'claude.intro', 'codex.intro', 'both.heading', 'both.before', 'both.after', 'start.intro', 'start.link', 'limit.source'];
/** The keys only the Turkish file has: it shows a translation of the Codex sentence before the English original, which the English file never needs. */
export const TURKISH_KEYS: readonly string[] = ['limit.original', 'limit.translation'];

/** The keys the content file of a language must hold. */
export const keysOf = (lang: Lang): readonly string[] => (lang === 'tr' ? [...TEXT_KEYS, ...TURKISH_KEYS] : TEXT_KEYS);

/** Checks that every key of a content file is text that is not empty or only white space, so a typo can never print an empty paragraph; throws `agents content: missing <key>`. */
export function readAgentsContent(frontmatter: unknown, lang: Lang): AgentsContent {
  const at = (path: string): unknown => path.split('.').reduce<unknown>((value, key) => (value !== null && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined), frontmatter);
  for (const key of keysOf(lang)) {
    const value = at(key);
    if (typeof value !== 'string' || value.trim() === '') throw new Error(`agents content: missing ${key}`);
  }
  return frontmatter as AgentsContent;
}
