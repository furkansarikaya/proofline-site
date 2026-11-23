// Helpers of the get-started page (TASK-021): the page addresses, the command lines of the page, the check of those lines against the README at the pin, and the
// check of the content files. The lines are typed here and never read from the README; every one of them must equal a `readme_commands` entry (or the span a
// `readme_inline_spans` member) of the pin facts before the page renders, so a reworded README fails the build (PRD FR-4). Erasable TypeScript only and relative imports
// spelled with `.ts` or `.mjs`, so Vite (the Astro build) and Node type stripping (`node --test`) load this one file, as they load home.ts.
import { join } from 'node:path';
import { readPinFacts } from '../../scripts/lib/pin-facts.mjs';
import { pinnedCommands } from './home.ts';
import type { Lang } from './meta.ts';

/** The address of the page in each language (ADR 0002 point 1); the pair is registered in translations.ts. */
export const GET_STARTED_PAGE: Readonly<Record<Lang, string>> = { en: '/get-started/', tr: '/tr/baslarken/' };

/** The two plugin lines of the Claude Code part. */
export const CLAUDE_LINES: readonly string[] = ['/plugin marketplace add furkansarikaya/proofline', '/plugin install proofline@proofline'];
/** The two lines of the Codex part (the README shows a comment after the second one; the block shows the command only). */
export const CODEX_LINES: readonly string[] = ['git clone https://github.com/furkansarikaya/proofline', 'node proofline/adapters/codex/install.mjs'];
/** The three commands of the first task that run in a terminal in the project. */
export const FIRST_LINES: readonly string[] = ['proofline init', 'proofline doctor', 'proofline status'];
/** The two lines of the first task that run in the Claude Code session. */
export const TASK_COMMANDS: readonly string[] = ['/proofline task --grill Add rate limiting to the login endpoint', '/proofline run TASK-001'];
/** The whole README span of the skills-only install, with its trailing name placeholder (the guard compares the whole span). */
export const SKILLS_SPAN = 'npx skills add furkansarikaya/proofline --skill <name>';

/** The part of the pin facts this page reads. */
export interface StartFacts {
  readonly readme_commands: readonly string[];
  readonly readme_inline_spans: readonly string[];
}

/** The pin facts of the repository under `root`: sync/pin.json and the cached documents. A missing fact throws and the build fails. */
export function startFacts(root: string = process.cwd()): StartFacts {
  return readPinFacts(join(root, 'sync', 'pin.json'), join(root, '.cache', 'sync'));
}

/** `lines`, when every one of them is a README command of the pin (through `pinnedCommands` of the home page); else it throws naming the page and the first absent line. */
export function pinnedLines(page: string, readmeCommands: readonly string[], lines: readonly string[]): readonly string[] {
  try {
    return pinnedCommands(readmeCommands, lines);
  } catch {
    throw new Error(`${page}: command not in the README at the pin: ${lines.find((line) => !readmeCommands.includes(line))}`);
  }
}

const collapse = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** `span`, when it equals a README inline span of the pin as a whole (white space collapsed, as the guard compares); else it throws naming the page and the span. */
export function pinnedSpan(page: string, readmeSpans: readonly string[], span: string): string {
  if (!readmeSpans.some((candidate) => collapse(candidate) === collapse(span))) throw new Error(`${page}: span not in the README at the pin: ${span}`);
  return span;
}

export interface GetStartedContent {
  readonly title: string;
  readonly lead: string;
  readonly claude: { readonly intro: string };
  readonly codex: { readonly intro: string };
  readonly first: { readonly heading: string; readonly intro: string; readonly skills: { readonly before: string; readonly after: string } };
  readonly measured: string;
}

// Every key of a get-started content file is text with something in it.
const TEXT_KEYS = ['title', 'lead', 'claude.intro', 'codex.intro', 'first.heading', 'first.intro', 'first.skills.before', 'first.skills.after', 'measured'];

/** Checks that every key of a get-started content file is text that is not empty or only white space, so a typo can never print an empty paragraph; throws `get-started content: missing <key>`. */
export function readGetStartedContent(frontmatter: unknown): GetStartedContent {
  const at = (path: string): unknown => path.split('.').reduce<unknown>((value, key) => (value !== null && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined), frontmatter);
  for (const key of TEXT_KEYS) {
    const value = at(key);
    if (typeof value !== 'string' || value.trim() === '') throw new Error(`get-started content: missing ${key}`);
  }
  return frontmatter as GetStartedContent;
}
