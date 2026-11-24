// Helpers of the home page (TASK-019): the pin facts read at build time, the excerpt rule, the pinned addresses, the command check, the link gate
// and the check of the home content files. Pin-derived text (the excerpt, the commit, the tag) is never typed in the source: it comes from
// `readPinFacts` of scripts/lib/pin-facts.mjs (ADR 0003 point 7). Erasable TypeScript only and relative imports spelled with `.ts` or `.mjs`, so Vite
// (the Astro build) and Node type stripping (`node --test`) load this one file, as they load nav.ts.
import { join } from 'node:path';
import { readPinFacts } from '../../scripts/lib/pin-facts.mjs';
import type { Lang } from './meta.ts';
import { REPO_URL } from './nav.ts';
import { index } from './translations.ts';
import type { Pair } from './translations.ts';

/** The five items of the "Real output" section of the pinned workflow page, as `readPinFacts` returns them. */
export interface RealOutput {
  readonly anchor: string;
  readonly opening: string;
  readonly cause: string;
  readonly tests: string;
  readonly review: string;
  readonly commit: string;
}

/** The part of the pin facts the home page reads. */
export interface HomeFacts {
  readonly commit: string;
  readonly tag: string | null;
  readonly readme_commands: readonly string[];
  readonly real_output: RealOutput;
}

/** The pin facts of the repository under `root`: sync/pin.json and the cached documents. Nothing is cached and there is no default: a missing fact throws and the build fails. */
export function homeFacts(root: string = process.cwd()): HomeFacts {
  return readPinFacts(join(root, 'sync', 'pin.json'), join(root, '.cache', 'sync'));
}

/** The composition rule of the excerpt: the five `real_output` items in source order, one blank line between them, nothing added or removed. It returns the unrendered source
 *  text, Markdown markers included; the page renders it through `renderMarkdown` of scripts/lib/transform.mjs (RealOutput.astro), so the markers show as strong and code. */
export function excerptText(r: RealOutput): string {
  return [r.opening, r.cause, r.tests, r.review, r.commit].join('\n\n');
}

/** The workflow page of the proofline repository at the pinned commit, at the anchor of the "Real output" heading. */
export function workflowHref(commit: string, anchor: string): string {
  return `${REPO_URL}/blob/${commit}/docs/concepts/workflow.md#${anchor}`;
}

/** The text of the caption link: the document path and the anchor. */
export function workflowLabel(anchor: string): string {
  return `docs/concepts/workflow.md#${anchor}`;
}

/** The "Status" section of the README at the pinned commit (the extractor throws unless the README has `## Status`, so the fragment always resolves). */
export function readmeHref(commit: string): string {
  return `${REPO_URL}/blob/${commit}/README.md#status`;
}

/** The install command of the first screen and of step 1, and the two task commands of step 2. Each line must be a README command of the pin (see `pinnedCommands`). */
export const INSTALL = {
  label: 'Claude Code',
  lines: ['/plugin marketplace add furkansarikaya/proofline', '/plugin install proofline@proofline'],
} as const;
export const TASK_LINES = ['/proofline task --grill Add rate limiting to the login endpoint', '/proofline run TASK-001'] as const;

/** `lines`, when every one of them equals an entry of `readme_commands` (the extractor already trimmed those and cut their trailing comments); else it throws naming the first absent line. */
export function pinnedCommands(readmeCommands: readonly string[], lines: readonly string[]): readonly string[] {
  for (const line of lines) {
    if (!readmeCommands.includes(line)) throw new Error(`home: command not in the README at the pin: ${line}`);
  }
  return lines;
}

/** The links of the home page to other pages. A link is printed only when its page pair is registered in the translation index (ADR 0011: registration is existence,
 *  the rule `menu()` of nav.ts uses), so no built home page can link to an address that is missing from the build. */
export const HOME_LINKS = {
  getStarted: { pair: { en: '/get-started/', tr: '/tr/baslarken/' }, href: { en: '/get-started/', tr: '/tr/baslarken/' } },
  concepts: { pair: { en: '/docs/', tr: '/tr/docs/' }, href: { en: '/docs/#concepts', tr: '/docs/#concepts' } },
  skills: { pair: { en: '/docs/', tr: '/tr/docs/' }, href: { en: '/docs/skills/', tr: '/docs/skills/' } },
} as const;

export interface HomeLinks {
  getStarted?: string;
  concepts?: string;
  skills?: string;
}

/** The addresses of the home links whose page pair is registered in `pairs`; an unregistered link has no key. */
export function homeLinks(lang: Lang, pairs: readonly Pair[] = index.pairs): HomeLinks {
  const links: HomeLinks = {};
  for (const [name, link] of Object.entries(HOME_LINKS) as [keyof typeof HOME_LINKS, (typeof HOME_LINKS)[keyof typeof HOME_LINKS]][]) {
    if (pairs.some((pair) => pair.en === link.pair.en && pair.tr === link.pair.tr)) links[name] = link.href[lang];
  }
  return links;
}

export interface HomeContent {
  readonly lead: string;
  readonly headline: { readonly muted: string; readonly ink: string };
  readonly note: string;
  readonly run: {
    readonly heading: { readonly before: string; readonly ink: string; readonly after: string };
    readonly steps: readonly [string, string, string];
  };
  readonly excerpt: { readonly caption: string; readonly source: string };
  readonly docs: { readonly before: string; readonly concepts: string; readonly middle: string; readonly skills: string; readonly after: string };
  readonly limits: { readonly before: string; readonly site: string; readonly middle: string; readonly readme: string; readonly after: string };
}

// The text keys of a home content file; the two that may be empty hold the part of the section headline before and after the one inked part.
const TEXT_KEYS = [
  'lead', 'headline.muted', 'headline.ink', 'note', 'run.heading.before', 'run.heading.ink', 'run.heading.after', 'excerpt.caption', 'excerpt.source',
  'docs.before', 'docs.concepts', 'docs.middle', 'docs.skills', 'docs.after', 'limits.before', 'limits.site', 'limits.middle', 'limits.readme', 'limits.after',
];
const MAY_BE_EMPTY = new Set(['run.heading.before', 'run.heading.after']);

/** Checks that every key of a home content file is text (`run.steps` exactly three), so a typo can never print an empty paragraph; throws `home content: missing <key>`. */
export function readHomeContent(frontmatter: unknown): HomeContent {
  const at = (path: string): unknown => path.split('.').reduce<unknown>((value, key) => (value !== null && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined), frontmatter);
  for (const key of TEXT_KEYS) {
    const value = at(key);
    if (typeof value !== 'string' || (value === '' && !MAY_BE_EMPTY.has(key))) throw new Error(`home content: missing ${key}`);
  }
  const steps = at('run.steps');
  if (!Array.isArray(steps) || steps.length !== 3 || steps.some((step) => typeof step !== 'string' || step === '')) throw new Error('home content: missing run.steps');
  return frontmatter as HomeContent;
}
