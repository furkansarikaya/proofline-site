// C16 Markdown transform and sanitizer (TASK-008): the only Markdown renderer of the site and the cross-site-scripting boundary of the synced documents.
// Pure and deterministic: no file system, no clock, no random value, no environment, no module state; a new processor and a new slugger are made per call.
// Safety is structural (ADR 0003 point 5): `remarkSafe` rebuilds the parsed mdast from an allowlist (raw HTML becomes text, comments are read and dropped, an unsafe
// link target becomes text, no `data` field is copied, an unknown node type throws), remark-rehype runs without `allowDangerousHtml`, and `assertSafeHast` walks the
// result and throws on any element or property outside its allowlist. The output string is never searched or edited.
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import GithubSlugger from 'github-slugger';
import YAML from 'yaml';

/** Throws the one error shape of this module: `transform: <path>[:<line>]: <message>`. */
function fail(path, line, message) {
  throw new Error(`transform: ${path}${line === null || line === undefined ? '' : `:${line}`}: ${message}`);
}

// ---- rule U1: link targets ---------------------------------------------------------------------------------------------------------------------------

/** Whether a link target may become an `href`: `http`, `https` or `mailto` (any case), or no scheme at all. The target is cleaned like a browser's URL parser
 *  cleans it (tab and line breaks removed, leading control characters and spaces removed) before the scheme, the part before the first colon, is read. */
export function isSafeUrl(url) {
  if (typeof url !== 'string') return false;
  const cleaned = url.replace(/[\t\n\r]/g, '').replace(/^[\u0000- ]+/, '');
  const colon = cleaned.indexOf(':');
  const end = cleaned.search(/[/?#]/);
  if (colon === -1 || (end !== -1 && colon > end)) return true;
  return /^(?:https?|mailto)$/i.test(cleaned.slice(0, colon));
}

// ---- rule U6: frontmatter ----------------------------------------------------------------------------------------------------------------------------

/** The end of the line that starts at `from`: `[end of its text, start of the next line]`. */
function lineEnd(text, from) {
  let i = from;
  while (i < text.length && text[i] !== '\n' && text[i] !== '\r') i++;
  const next = i < text.length ? (text[i] === '\r' && text[i + 1] === '\n' ? i + 2 : i + 1) : i;
  return [i, next];
}

/** The text without its leading U+FEFF characters. micromark drops one leading U+FEFF itself and does not count it in its offsets, so the body that is parsed and
 *  sliced must not start with one: with a second one left, the parser and the slices would be one character apart. */
const withoutBom = (text) => text.replace(/^\ufeff+/, '');

/** Splits the frontmatter block off a document. The block is masked, not sliced: every character of it except the line breaks becomes a space, so the lines and the
 *  offsets of the body are those of the file and nothing of the block reaches the mdast. */
function splitFrontmatter(path, source) {
  const text = withoutBom(source);
  const [openEnd] = lineEnd(text, 0);
  if (!/^---[ \t]*$/.test(text.slice(0, openEnd))) return { body: text, frontmatter: {} };
  const afterOpen = lineEnd(text, 0)[1];
  let at = afterOpen;
  let closer = -1;
  let closerEnd = -1;
  while (at < text.length) {
    const [end, next] = lineEnd(text, at);
    if (/^(?:---|\.\.\.)[ \t]*$/.test(text.slice(at, end))) {
      closer = at;
      closerEnd = next;
      break;
    }
    at = next;
  }
  if (closer === -1) fail(path, 1, 'frontmatter is not closed');
  let value;
  try {
    value = YAML.parse(text.slice(afterOpen, closer));
  } catch (error) {
    fail(path, 1, `frontmatter is not valid YAML: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
  }
  if (value === null || value === undefined) value = {};
  if (typeof value !== 'object' || Array.isArray(value)) fail(path, 1, 'frontmatter is not a mapping');
  return { body: text.slice(0, closerEnd).replace(/[^\r\n]/g, ' ') + text.slice(closerEnd), frontmatter: value };
}

// ---- rules U2 to U5 and U7: the mdast pass -----------------------------------------------------------------------------------------------------------

const COPY_CHILDREN = new Set(['paragraph', 'blockquote', 'emphasis', 'strong', 'delete', 'tableRow', 'tableCell']);
const FLOW_PARENTS = new Set(['root', 'blockquote', 'listItem']);
const ALIGNS = new Set(['left', 'right', 'center']);
// The source is a repository path: letters, digits, `.`, `_`, `-` and `/` only, so no markup or quote can ride in it.
const TRANSLATED = /^translated-from:\s*([A-Za-z0-9._/-]+)\s*;\s*blob:\s*([0-9a-f]{40})$/;

/** The inner text of an `html` node value that is exactly one comment (it opens with `<!--` and its first `-->` ends the value), else `null`. A value that holds the
 *  early close `--!>` is not a comment: a browser ends the comment there, so what follows is markup, and it is shown as text, never deleted. Read on the parsed
 *  node, never on output. */
function commentInner(value) {
  const v = String(value).trim();
  if (!v.startsWith('<!--') || v.indexOf('-->', 2) !== v.length - 3 || v.includes('--!>')) return null;
  return v.slice(4, v.length - 3).trim();
}

/** The visible text of rebuilt nodes: the `value` of the text and code nodes below them (the rule of mdast-util-to-string). */
function visibleText(node) {
  if (typeof node.value === 'string') return node.value;
  return Array.isArray(node.children) ? node.children.map(visibleText).join('') : '';
}

/** The state of one call: what the pass reads and collects. `ctx` is `{ path, mode, rewrite }`, `body` the masked text that is parsed. */
function makeState(ctx, body) {
  const starts = [0];
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '\n' || (body[i] === '\r' && body[i + 1] !== '\n')) starts.push(i + 1);
  }
  return {
    ...ctx,
    body,
    slugger: new GithubSlugger(),
    headings: [],
    links: [],
    translatedFrom: null,
    /** The 1-based line of an offset of `body`. */
    lineOf(offset) {
      let line = 0;
      while (line + 1 < starts.length && starts[line + 1] <= offset) line++;
      return line + 1;
    },
  };
}

/** The unified plugin of the allowlist rebuild: it returns a new tree built node by node and copies only the fields the rule table names. */
function remarkSafe(state) {
  const { path, body } = state;
  const where = (node) => node?.position?.start?.line ?? null;
  const offsetOf = (node, which) => node?.position?.[which]?.offset;
  const text = (value) => ({ type: 'text', value });
  const slice = (node) => {
    const start = offsetOf(node, 'start');
    const end = offsetOf(node, 'end');
    if (typeof start !== 'number' || typeof end !== 'number') fail(path, where(node), `node of type ${node?.type} has no source position`);
    return body.slice(start, end);
  };

  /** The line where the target of an inline link or an image is written: after the first `](` that follows `from`. */
  const targetLine = (node, from) => {
    const end = offsetOf(node, 'end');
    let at = body.indexOf('](', from);
    if (typeof end !== 'number' || at === -1 || at >= end) return where(node);
    at += 2;
    while (at < end && /\s/.test(body[at])) at++;
    return state.lineOf(at);
  };

  /** The target after `rewrite`, checked again: a rewrite bug can never add an unsafe link. */
  const rewritten = (url, line, kind) => {
    if (!state.rewrite) return url;
    const target = state.rewrite(url, { path, line, kind });
    if (typeof target !== 'string' || !isSafeUrl(target)) fail(path, line, 'rewrite returned an unsafe target');
    return target;
  };

  return (tree) => {
    if (tree === null || typeof tree !== 'object' || tree.type !== 'root') fail(path, null, 'the tree is not a root node');

    // 4a: the definitions, first one wins; the Map is only read by key.
    const definitions = new Map();
    const collect = (node) => {
      if (node === null || typeof node !== 'object') return; // `rebuild` names it: a node has no type
      if (node.type === 'definition') {
        const key = String(node.identifier).toUpperCase();
        if (!definitions.has(key)) definitions.set(key, node);
      }
      if (Array.isArray(node.children)) node.children.forEach(collect);
    };
    collect(tree);

    const kids = (node, inLink) => (Array.isArray(node.children) ? node.children.flatMap((child) => rebuild(child, node, inLink)) : []);

    /** Step 4c: the entry goes into `links` first, then the label is rebuilt, then the target decides: unsafe or inside another link gives `fallback`, else one link. */
    const makeLink = (url, line, kind, labelOf, fallbackOf, inLink) => {
      const entry = { kind, url, line, rendered: false };
      state.links.push(entry);
      const label = labelOf();
      if (inLink || !isSafeUrl(url)) return fallbackOf(label);
      const target = rewritten(url, line, kind);
      entry.rendered = true;
      return [{ type: 'link', url: target, children: label }];
    };

    /** Step 4d: an image is its alt text (the target when there is none), as a link to the same target, never an `img`. */
    const makeImage = (node, url, line, inLink) => {
      const label = typeof node.alt === 'string' && node.alt !== '' ? node.alt : url;
      return makeLink(url, line, 'image', () => [text(label)], (own) => own, inLink);
    };

    const rebuild = (node, parent, inLink) => {
      if (node === null || typeof node !== 'object' || typeof node.type !== 'string') fail(path, null, 'a node has no type');
      const { type } = node;
      if (COPY_CHILDREN.has(type)) return [{ type, children: kids(node, inLink) }];
      switch (type) {
        case 'root':
          return [{ type, children: kids(node, inLink) }];
        case 'heading': {
          const children = kids(node, inLink);
          const shown = visibleText({ children });
          const id = state.slugger.slug(shown);
          state.headings.push({ depth: node.depth, text: shown, id });
          const heading = { type, depth: node.depth, children };
          if (id !== '') heading.data = { hProperties: { id } };
          return [heading];
        }
        case 'thematicBreak':
        case 'break':
          return [{ type }];
        case 'text':
        case 'inlineCode':
        case 'code':
          return [{ type, value: node.value }];
        case 'list':
          return [{ type, ordered: node.ordered, start: node.start, spread: node.spread, children: kids(node, inLink) }];
        case 'listItem': {
          const children = kids(node, inLink);
          if (typeof node.checked === 'boolean') {
            const marker = text(node.checked ? '[x] ' : '[ ] ');
            if (children[0]?.type === 'paragraph') children[0].children.unshift(marker);
            else children.unshift({ type: 'paragraph', children: [marker] });
          }
          return [{ type, spread: node.spread, children }];
        }
        case 'table': {
          const align = Array.isArray(node.align) ? node.align : [];
          for (const a of align) if (a !== null && !ALIGNS.has(a)) fail(path, where(node), `unsupported table alignment ${String(a)}`);
          return [{ type, align: [...align], children: kids(node, inLink) }];
        }
        case 'html': {
          const inner = commentInner(node.value);
          if (inner !== null) {
            if (state.mode === 'document' && inner.startsWith('translated-from')) {
              const match = TRANSLATED.exec(inner);
              if (match === null) fail(path, where(node), 'malformed translated-from header');
              if (state.translatedFrom !== null) fail(path, where(node), 'a second translated-from header');
              state.translatedFrom = { source: match[1], blob: match[2] };
            }
            return [];
          }
          if (FLOW_PARENTS.has(parent.type)) return [{ type: 'paragraph', children: [text(node.value)] }];
          return [text(node.value)];
        }
        case 'link': {
          // A tree made by hand has no positions: such a link is an ordinary link written inline.
          const source = typeof offsetOf(node, 'start') === 'number' ? slice(node) : '';
          const children = node.children ?? [];
          let line = where(node);
          if (source.startsWith('[')) {
            const last = children.length > 0 ? offsetOf(children[children.length - 1], 'end') : undefined;
            line = targetLine(node, typeof last === 'number' ? last : offsetOf(node, 'start') + 1);
          }
          // An unsafe angle autolink shows its source with the brackets; any other unsafe link shows its label.
          const fallback = source.startsWith('<') ? () => [text(source)] : (label) => label;
          return makeLink(node.url, line, 'link', () => kids(node, true), fallback, inLink);
        }
        case 'linkReference': {
          const def = definitions.get(String(node.identifier).toUpperCase());
          if (def === undefined) return [text(slice(node))];
          return makeLink(def.url, def.position?.start?.line ?? where(node), 'link', () => kids(node, true), (label) => label, inLink);
        }
        case 'image':
          return makeImage(node, node.url, targetLine(node, offsetOf(node, 'start') ?? 0), inLink);
        case 'imageReference': {
          const def = definitions.get(String(node.identifier).toUpperCase());
          if (def === undefined) return [text(slice(node))];
          return makeImage(node, def.url, def.position?.start?.line ?? where(node), inLink);
        }
        case 'definition':
          return [];
        case 'footnoteReference':
          return [text(slice(node))];
        case 'footnoteDefinition':
          return [{ type: 'paragraph', children: [text(slice(node))] }];
        default:
          return fail(path, where(node), `unsupported node type ${String(type)}`);
      }
    };

    return rebuild(tree, null, false)[0];
  };
}

// ---- rule U8: the hast guard -------------------------------------------------------------------------------------------------------------------------

const BARE = new Set(['p', 'blockquote', 'ul', 'li', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'em', 'strong', 'del', 'br', 'hr']);
const HEADING = /^h[1-6]$/;

/** Checks one property of one allowed element; returns a description of the problem or `null`. */
function propertyProblem(tag, name, value) {
  if (HEADING.test(tag) && name === 'id') return typeof value === 'string' && value !== '' ? null : 'an id that is not a non-empty string';
  if (tag === 'ol' && name === 'start') return Number.isInteger(value) ? null : 'a start that is not an integer';
  if ((tag === 'th' || tag === 'td') && name === 'align') return typeof value === 'string' && ALIGNS.has(value) ? null : `an align of ${String(value)}`;
  if (tag === 'a' && name === 'href') return typeof value === 'string' && isSafeUrl(value) ? null : 'an href that is not a safe target';
  return `the property ${name} on ${tag}`;
}

/** Walks a hast tree and throws unless every node is `root`, `element` or `text` and every element and property is on the allowlist. A tree walk, never a string search. */
export function assertSafeHast(hast, path) {
  const bad = (what) => fail(path, null, `unsafe output: ${what}`);
  const walk = (node) => {
    if (node === null || typeof node !== 'object') return bad('a node that is not an object');
    if (node.type === 'text') {
      if (typeof node.value !== 'string') bad('a text node without a string value');
      return undefined;
    }
    if (node.type !== 'root' && node.type !== 'element') return bad(`a ${String(node.type)} node`);
    if (node.type === 'element') {
      const tag = node.tagName;
      if (typeof tag !== 'string' || !(BARE.has(tag) || HEADING.test(tag) || tag === 'ol' || tag === 'th' || tag === 'td' || tag === 'a')) bad(`the element ${String(tag)}`);
      const properties = node.properties ?? {};
      if (typeof properties !== 'object' || Array.isArray(properties)) bad(`properties of ${tag} that are not an object`);
      for (const name of Object.keys(properties)) {
        const problem = BARE.has(tag) ? `the property ${name} on ${tag}` : propertyProblem(tag, name, properties[name]);
        if (problem !== null) bad(problem);
      }
    }
    if (!Array.isArray(node.children)) return bad(`a ${node.type} node without children`);
    for (const child of node.children) walk(child);
    return undefined;
  };
  walk(hast);
}

/** The unified plugin of the guard: it changes nothing and throws on a violation. */
function rehypeGuard(state) {
  return (tree) => {
    assertSafeHast(tree, state.path);
  };
}

// ---- the pipeline ------------------------------------------------------------------------------------------------------------------------------------

/** A new processor for one call; `parse` false is the hand-built tree of `renderTree`. */
function pipeline(state, parse) {
  const processor = unified();
  if (parse) processor.use(remarkParse).use(remarkGfm);
  return processor
    .use(remarkSafe, state)
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeGuard, state)
    .use(rehypeStringify, { allowDangerousHtml: false });
}

/** The one internal function: both public renderers call it. `ctx` is `{ path, mode: 'document' | 'fragment', rewrite? }`. */
function render(text, ctx) {
  const { body, frontmatter } = ctx.mode === 'document' ? splitFrontmatter(ctx.path, text) : { body: withoutBom(text), frontmatter: {} };
  const state = makeState(ctx, body);
  let html;
  try {
    html = String(pipeline(state, true).processSync(body));
  } catch (error) {
    // The parser or the passes ran out of stack on a very deep nesting: the same error shape as every other failure (Decision 8).
    if (error instanceof RangeError) fail(ctx.path, null, `the document could not be rendered: ${error.message}`);
    throw error;
  }
  return { frontmatter, html, headings: state.headings, translatedFrom: state.translatedFrom, links: state.links };
}

/** Renders a hand-built mdast through the pass, remark-rehype, the guard and the stringifier (test seam of the rule tables U7 and U8). `source` is the text that the
 *  positions of the tree refer to. Returns `{ html, headings, links, translatedFrom }`. */
export function renderTree(mdast, { path, source = '', mode = 'document', rewrite } = {}) {
  if (typeof path !== 'string' || path === '') fail('(invalid path)', null, 'path must be a non-empty string');
  const state = makeState({ path, mode, rewrite }, String(source));
  const processor = pipeline(state, false);
  const html = String(processor.stringify(processor.runSync(mdast)));
  return { html, headings: state.headings, links: state.links, translatedFrom: state.translatedFrom };
}

/** Transforms one synced document: `path` is the repository path (error messages and `rewrite` only), `source` the file text. `options.rewrite(url, { path, line, kind })`
 *  returns the target to print for a safe target (TASK-009 supplies it); without it targets are unchanged.
 *  @returns {{ frontmatter: Record<string, unknown>, html: string, headings: { depth: number, text: string, id: string }[],
 *    translatedFrom: { source: string, blob: string } | null, links: { kind: 'link' | 'image', url: string, line: number, rendered: boolean }[] }} */
export function transformDocument(path, source, options = {}) {
  if (typeof path !== 'string' || path === '') fail('(invalid path)', null, 'path must be a non-empty string');
  if (typeof source !== 'string') fail(path, null, 'source must be a string');
  if (options === null || typeof options !== 'object') fail(path, null, 'options must be an object');
  if (options.rewrite !== undefined && typeof options.rewrite !== 'function') fail(path, null, 'options.rewrite must be a function');
  return render(source, { path, mode: 'document', rewrite: options.rewrite });
}

/** The excerpt path: the same pipeline, no frontmatter split, no translated-from read, no rewrite; the HTML only. */
export function renderMarkdown(text) {
  if (typeof text !== 'string') fail('(fragment)', null, 'text must be a string');
  return render(text, { path: '(fragment)', mode: 'fragment' }).html;
}
