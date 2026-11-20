// The synced set of TASK-007 (ADR 0003 point 4): the six globs of documents that the sync copies from the proofline
// repository, and the one input that is locked but not shown as a page. Pure functions, no file system, no network.
// A `*` stands for one path segment (no slash); every other character is literal; the whole path is matched.

export const SYNCED_SET = Object.freeze([
  'docs/guides/*.md',
  'docs/guides/tr/*.md',
  'docs/concepts/*.md',
  'docs/proof.md',
  'docs/limits.md',
  'skills/*/SKILL.md',
]);

export const INPUTS = Object.freeze(['README.md']);

/** Group of each glob, in the order of SYNCED_SET (globs four and five share one group). */
const GLOB_GROUPS = Object.freeze(['guides', 'turkish guides', 'concepts', 'proof and limits', 'proof and limits', 'skills']);

/** Every group name once, in the order the lock summary prints them. */
export const GROUPS = Object.freeze(['guides', 'turkish guides', 'concepts', 'proof and limits', 'skills', 'input']);

const escape = (text) => text.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
const MATCHERS = SYNCED_SET.map((glob) => new RegExp(`^${glob.split('*').map(escape).join('[^/]+')}$`));

/** 'page' for a path in the synced set, 'input' for a locked input, null for everything else. */
export function roleOf(path) {
  if (INPUTS.includes(path)) return 'input';
  return MATCHERS.some((matcher) => matcher.test(path)) ? 'page' : null;
}

/** The group a synced or input path is counted in, or null. */
export function groupOf(path) {
  if (INPUTS.includes(path)) return 'input';
  const at = MATCHERS.findIndex((matcher) => matcher.test(path));
  return at === -1 ? null : GLOB_GROUPS[at];
}
