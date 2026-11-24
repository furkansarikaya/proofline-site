// Node tests for the not-found page in English and Turkish (TASK-024).
// The `before` hook fetches the pinned documents, builds the real site once into a folder of its own under .cache (never dist/, never the shared .tmp), opens one Vite server
// for the Astro container and renders the page FILE (src/pages/404.astro) and the header, footer and layout components with explicit lists of registered page pairs. Every
// test only reads what the hook produced, so the per-test budgets measure assertions only. The texts of the page are written out here and never read from the code under test.
// Every rule is a small checker that returns its problems; the built page and each rendered state must have none, and each rule has a probe page that breaks it.
import { after, before, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getViteConfig } from 'astro/config';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { load } from 'cheerio';
import { createServer } from 'vite';
import { startServer } from '../scripts/serve-dist.mjs';
import { ENV_KEYS } from '../src/lib/indexing.ts';
import { DOCS_PAIR, notFoundLinks } from '../src/lib/not-found.ts';
import { controlsScript } from '../src/lib/nav.ts';
import { PAIRS, switcherTarget } from '../src/lib/translations.ts';
import { makeTempDir, removeTempDirs, sweepStale } from './temp-dirs.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
sweepStale();
after(removeTempDirs);

// ---- the strings of the TASK-024 Context, written out here and never read from the code under test ---------------------------------------------------------

const PHRASE = 'proofline: a deterministic engineering team for Claude Code and Codex';
const TITLE = `Page not found | ${PHRASE}`;
const OLD_TITLE = `Page not found | Sayfa bulunamadı | ${PHRASE}`;
const HEADING = { en: 'Page not found', tr: 'Sayfa bulunamadı' };
const SENTENCE = { en: 'This address does not exist.', tr: 'Bu adres mevcut değil.' };
const HOME = { en: ['/', 'Home'], tr: ['/tr/', 'Ana sayfa'] };
const DOCS = { en: ['/docs/', 'Docs'], tr: ['/tr/docs/', 'Belgeler'] };
const REPO = 'https://github.com/furkansarikaya/proofline';
const SITE_REPO = 'https://github.com/furkansarikaya/proofline-site';
const FOOTER = {
  en: 'No cookies and no analytics scripts. The host keeps ordinary request logs. MIT licensed (LICENSE). Built with proofline.',
  tr: 'Çerez ve analitik betiği yok. Barındırıcı olağan istek günlüklerini tutar. MIT lisanslı (LICENSE). proofline ile yapıldı.',
};
const BUILT_LINK = { en: 'Built with proofline', tr: 'proofline ile yapıldı' };
// The five menu entries in the order of ADR 0002 point 8, each with its pair; an entry is listed exactly when its pair is registered.
const MENU_ALL = [
  { en: ['/', 'Home'], pair: { en: '/', tr: '/tr/' } },
  { en: ['/get-started/', 'Get started'], pair: { en: '/get-started/', tr: '/tr/baslarken/' } },
  { en: ['/docs/', 'Docs'], pair: { en: '/docs/', tr: '/tr/docs/' } },
  { en: ['/trust/', 'Trust'], pair: { en: '/trust/', tr: '/tr/guven/' } },
  { en: ['/claude-code-and-codex/', 'Claude Code + Codex'], pair: { en: '/claude-code-and-codex/', tr: '/tr/claude-code-ve-codex/' } },
];
const expectedMenu = (pairs) => MENU_ALL.filter((entry) => pairs.some((pair) => pair.en === entry.pair.en && pair.tr === entry.pair.tr)).map((entry) => entry.en);
const registered = (pairs) => pairs.some((pair) => pair.en === '/docs/' && pair.tr === '/tr/docs/');
// The six pages that keep their language link and their one-language footer.
const OTHER_PAGES = [
  ['en', 'index.html', '/'],
  ['tr', 'tr/index.html', '/tr/'],
  ['en', 'get-started/index.html', '/get-started/'],
  ['tr', 'tr/baslarken/index.html', '/tr/baslarken/'],
  ['en', 'claude-code-and-codex/index.html', '/claude-code-and-codex/'],
  ['tr', 'tr/claude-code-ve-codex/index.html', '/tr/claude-code-ve-codex/'],
];
const PAGE_FILE = 'src/pages/404.astro';
// The classes the page may use: all of them exist in the stylesheet of the get-started page already.
const CLASSES = ['gs', 'gs-col', 'gs-h1', 'gs-h2', 'gs-p', 'gs-part', 'grid', 'wrap'];

const squash = (text) => text.replace(/\s+/g, ' ').trim();
const read = (rel) => (existsSync(join(root, rel)) ? readFileSync(join(root, rel), 'utf8') : '');

function walk(dir, prefix = '') {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walk(join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out.sort();
}

/** The props of every `<tag ...>` element of an astro source as written (`name="text"` or `name={expression}`), in source order. */
function propsOf(source, tag) {
  const found = [];
  const open = new RegExp(`<${tag}(?=\\s)`, 'g');
  for (let match = open.exec(source); match !== null; match = open.exec(source)) {
    const props = {};
    let i = match.index + match[0].length;
    for (;;) {
      while (/\s/.test(source[i])) i += 1;
      if (source[i] === '>' || (source[i] === '/' && source[i + 1] === '>')) break;
      const name = /^[\w:-]+/.exec(source.slice(i))?.[0];
      assert.ok(name, `${tag}: a prop name at offset ${i}`);
      i += name.length;
      assert.equal(source[i], '=', `${tag}: ${name} has a value`);
      i += 1;
      const start = i;
      if (source[i] === '"') {
        i = source.indexOf('"', i + 1) + 1;
      } else {
        assert.equal(source[i], '{', `${tag}: ${name} is a string or an expression`);
        for (let depth = 0; ; i += 1) {
          if (source[i] === '{') depth += 1;
          if (source[i] === '}') depth -= 1;
          if (depth === 0) break;
          if (source[i] === "'" || source[i] === '"') i = source.indexOf(source[i], i + 1);
        }
        i += 1;
      }
      props[name] = squash(source.slice(start, i));
    }
    found.push(props);
  }
  return found;
}

/** A small http request: the status, the headers and the body of a path on a local server. */
function raw(url, path) {
  const u = new URL(url);
  return new Promise((resolve) => {
    const req = request({ host: u.hostname, port: u.port, path, method: 'GET' }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', () => resolve({ status: 0, headers: {}, body: '' }));
    req.end();
  });
}

// ---- the rules, each a checker that returns its problems ---------------------------------------------------------------------------------------------------

/** The files rule (AC-1, AC-8): one 404.html at the root of the build, one 404.astro in the sources, nothing else that starts with 404 anywhere. */
function fileProblems(built, sources) {
  const problems = [];
  if (!built.includes('404.html')) problems.push('404.html is missing from the build');
  for (const file of built) {
    if (file !== '404.html' && file.split('/').some((part) => part.startsWith('404'))) problems.push(`the build holds ${file}`);
  }
  if (built.filter((file) => file.split('/').at(-1) === '404.html').length > 1) problems.push('the build holds more than one file named 404.html');
  if (!sources.includes('404.astro')) problems.push('src/pages holds no 404.astro');
  for (const file of sources) {
    if (file !== '404.astro' && file.split('/').some((part) => part.startsWith('404'))) problems.push(`src/pages holds ${file}`);
  }
  return problems;
}

/** Every non-blank text node under a node, with the node itself. */
function textNodes(node, out = []) {
  for (const child of node.children ?? []) {
    if (child.type === 'text' && child.data.trim() !== '') out.push(child);
    else if (child.type === 'tag') textNodes(child, out);
  }
  return out;
}

/** The nearest element above a node that has a lang attribute. */
function langOwner(node) {
  for (let up = node.parent; up; up = up.parent) {
    if (up.name === 'html') return null;
    if (up.attribs?.lang !== undefined) return up;
  }
  return null;
}

/** The structure rule (AC-2): one English block, one Turkish block, each with its own lang and heading; no text of one language inside an element of the other. */
function structureProblems($) {
  const problems = [];
  const en = $('main [lang="en"]');
  const tr = $('main [lang="tr"]');
  if ($('html').attr('lang') !== 'en') problems.push('the html element is not lang="en"');
  if (en.length !== 1) problems.push(`main holds ${en.length} blocks with lang="en"`);
  if (tr.length !== 1) problems.push(`main holds ${tr.length} blocks with lang="tr"`);
  if ($('main [lang]').length !== 2) problems.push(`main holds ${$('main [lang]').length} elements with a lang, expected the two blocks`);
  if ($('h1').length !== 1) problems.push(`the page holds ${$('h1').length} H1 elements`);
  if (en.length !== 1 || tr.length !== 1) return problems;
  if (en.find('[lang]').length > 0) problems.push('the English block holds an element with its own lang');
  if (tr.find('[lang]').length > 0) problems.push('the Turkish block holds an element with its own lang');
  if (en.parentsUntil('main', '[lang]').length > 0) problems.push('the English block sits inside an element with a lang');
  if (tr.parentsUntil('main', '[lang]').length > 0) problems.push('the Turkish block sits inside an element with a lang');
  if (en.find('h1').length !== 1 || squash(en.find('h1').text()) !== HEADING.en) problems.push('the English block has no H1 "Page not found"');
  if (tr.find('h1').length > 0) problems.push('the Turkish block holds an H1');
  if (tr.find('h2').length !== 1 || squash(tr.find('h2').text()) !== HEADING.tr) problems.push('the Turkish block has no H2 with its heading');
  if (tr.find('h1, h2, h3, h4, h5, h6').length !== 1) problems.push('the Turkish block holds a heading other than its H2');
  if (en.find('h1, h2, h3, h4, h5, h6').length !== 1) problems.push('the English block holds a heading other than its H1');
  if (!en.find('p').toArray().some((p) => squash($(p).text()) === SENTENCE.en)) problems.push('the English block lacks its sentence');
  if (!tr.find('p').toArray().some((p) => squash($(p).text()) === SENTENCE.tr)) problems.push('the Turkish block lacks its sentence');
  for (const node of textNodes(en[0])) if (langOwner(node) !== en[0]) problems.push(`English text "${squash(node.data)}" sits inside an element of another language`);
  for (const node of textNodes(tr[0])) if (langOwner(node) !== tr[0]) problems.push(`Turkish text "${squash(node.data)}" sits inside an element of another language`);
  for (const node of textNodes($('main')[0])) if (langOwner(node) === null) problems.push(`text "${squash(node.data)}" sits outside both blocks`);
  return problems;
}

/** The links of each block, as [href, text] pairs. */
const linksOf = ($) => ({
  en: $('main [lang="en"] a[href]').toArray().map((a) => [a.attribs.href, squash($(a).text())]),
  tr: $('main [lang="tr"] a[href]').toArray().map((a) => [a.attribs.href, squash($(a).text())]),
});

/** The link rule (AC-3): the home link first, the docs link only when `docs`; each block holds its own language's links and nothing else; with `outDir` every target exists. */
function linkProblems($, docs, outDir = null) {
  const problems = [];
  const expected = { en: docs ? [HOME.en, DOCS.en] : [HOME.en], tr: docs ? [HOME.tr, DOCS.tr] : [HOME.tr] };
  const links = linksOf($);
  for (const lang of ['en', 'tr']) {
    if (JSON.stringify(links[lang]) !== JSON.stringify(expected[lang])) problems.push(`${lang} block links ${JSON.stringify(links[lang])}, expected ${JSON.stringify(expected[lang])}`);
  }
  if ($('main a[href]').length !== links.en.length + links.tr.length) problems.push('a link of main sits outside the two blocks');
  if (outDir !== null) {
    for (const [href] of [...links.en, ...links.tr]) {
      const file = join(outDir, href === '/' ? 'index.html' : `${href.slice(1)}index.html`);
      if (!existsSync(file)) problems.push(`${href} does not exist in the build`);
    }
  }
  return problems;
}

/** The home rule (AC-8): each block carries its own lang and a link to the home page of that language. */
function homeProblems($) {
  const problems = [];
  for (const lang of ['en', 'tr']) {
    const block = $(`main [lang="${lang}"]`);
    if (block.length !== 1) {
      problems.push(`there is no single block with lang="${lang}"`);
      continue;
    }
    if (block.find(`a[href="${HOME[lang][0]}"]`).length !== 1) problems.push(`the ${lang} block has no link to ${HOME[lang][0]}`);
  }
  return problems;
}

/** The head rule (AC-4): no alternate, no canonical, no refresh, no redirect, no script element. */
function headProblems($, html) {
  const problems = [];
  if ($('link[hreflang]').length > 0) problems.push('the page holds an hreflang link');
  if ($('link[rel~="alternate"]').length > 0) problems.push('the page holds an alternate link');
  if ($('link[rel~="canonical"]').length > 0) problems.push('the page holds a canonical link');
  if ($('meta[http-equiv]').length > 0) problems.push('the page holds a meta http-equiv');
  if ($('script').length > 0) problems.push(`the page holds ${$('script').length} script elements`);
  if ($('noscript').length > 0) problems.push('the page holds a noscript element');
  if (/refresh|window\.location|location\.(href|replace|assign)|location\s*=/i.test(html)) problems.push('the page text holds a redirect');
  return problems;
}

/** The title rule (AC-5): the English title, og:title equal to it, no evidence word, and an English description of 70 to 160 characters. */
function titleProblems($) {
  const problems = [];
  const title = $('title').text();
  const og = $('meta[property="og:title"]').attr('content') ?? '';
  if (title !== TITLE) problems.push(`the title is "${title}"`);
  if (og !== title) problems.push(`og:title is "${og}", expected the title`);
  for (const text of [title, og]) {
    for (const lowered of [text.toLowerCase(), text.toLocaleLowerCase('tr'), text.toLocaleLowerCase('en')]) {
      if (/evidence|kanıt|kanit/.test(lowered)) problems.push(`"${text}" holds an evidence word`);
    }
  }
  const description = $('meta[name="description"]').attr('content') ?? '';
  const length = Array.from(description).length;
  if (length < 70 || length > 160) problems.push(`the description is ${length} characters`);
  if (description !== `${SENTENCE.en} ${PHRASE}.`) problems.push(`the description is "${description}"`);
  if ($('meta[property="og:description"]').attr('content') !== description) problems.push('og:description is not the description');
  return problems;
}

/** The header rule of the not-found page (AC-6): brand, menu, GitHub link, theme button; no language link of any kind. */
function headerProblems($, menu) {
  const problems = [];
  const roles = $('header a[href], header button').toArray().map((el) => {
    if ($(el).hasClass('brand')) return 'brand';
    if (el.attribs.id === 'b-gh') return 'github';
    if (el.attribs.id === 'b-lang') return 'language';
    if (el.attribs.id === 'b-theme') return 'theme';
    return $(el).closest('nav').length === 1 ? 'menu' : 'other';
  });
  assert.ok(roles.length > 0, 'the header holds controls');
  const expectedRoles = ['brand', ...menu.map(() => 'menu'), 'github', 'theme'];
  if (JSON.stringify(roles) !== JSON.stringify(expectedRoles)) problems.push(`the header order is ${roles.join(', ')}, expected ${expectedRoles.join(', ')}`);
  if (JSON.stringify($('header nav a').toArray().map((a) => [a.attribs.href, squash($(a).text())])) !== JSON.stringify(menu)) problems.push('the menu entries differ');
  if ($('header .brand').attr('href') !== '/' || squash($('header .brand').text()) !== 'proofline') problems.push('the brand is not proofline linking to /');
  if ($('a#b-gh').attr('href') !== REPO) problems.push('the GitHub link does not point at the repository');
  if ($('button#b-theme').length !== 1) problems.push('the header holds no theme button');
  if ($('#b-lang').length > 0) problems.push('the header holds a language link');
  if ($('[hreflang]').length > 0) problems.push('the page holds an element with hreflang');
  if ($('header [lang]').length > 0) problems.push('the header holds an element with its own lang');
  if ($('[aria-label]').toArray().some((el) => /read this page in Turkish|bu sayfayı İngilizce oku/.test(el.attribs['aria-label']))) problems.push('the page names a language link');
  return problems;
}

/**
 * The footer rule of the not-found page (AC-6, DESIGN-marketing.md "Footer": the footer stays one paragraph): one footer after main holding ONE paragraph with no lang of its own;
 * in it exactly two inline span elements, English first then Turkish, each with its own lang and the N-3 text of its language and its two links, joined by plain whitespace;
 * no block-level element and no other element with a lang inside the footer.
 */
function footerProblems($, license) {
  const problems = [];
  if ($('footer').length !== 1) problems.push(`the page holds ${$('footer').length} footers`);
  if ($('main footer, footer main').length > 0) problems.push('the footer sits inside main');
  if (JSON.stringify($('body').children().toArray().map((el) => el.tagName)) !== JSON.stringify(['header', 'main', 'footer'])) problems.push('the body is not header, main, footer');
  const paragraphs = $('footer p').toArray();
  if (paragraphs.length !== 1) {
    problems.push(`the footer holds ${paragraphs.length} paragraphs`);
    return problems;
  }
  const paragraph = $(paragraphs[0]);
  if (paragraph.attr('lang') !== undefined) problems.push('the footer paragraph carries a lang of its own');
  if ($('footer').children().toArray().map((el) => el.tagName).join() !== 'p') problems.push('the footer holds something besides the paragraph');
  if ($('footer :is(div, section, article, aside, ul, ol, li, h1, h2, h3, h4, h5, h6, blockquote, br)').length > 0) problems.push('the footer holds a block-level element or a break');
  const spans = paragraph.children().toArray();
  if (JSON.stringify(spans.map((el) => el.tagName)) !== JSON.stringify(['span', 'span'])) {
    problems.push(`the footer paragraph holds the elements ${JSON.stringify(spans.map((el) => el.tagName))}, not two spans`);
    return problems;
  }
  if ($('footer [lang]').toArray().map((el) => `${el.tagName}:${el.attribs.lang}`).join() !== 'span:en,span:tr') problems.push('the lang attributes of the footer are not the two spans, English then Turkish');
  spans.forEach((span, i) => {
    const lang = ['en', 'tr'][i];
    if ($(span).attr('lang') !== lang) problems.push(`footer span ${i + 1} is not lang="${lang}"`);
    if (squash($(span).text()) !== FOOTER[lang]) problems.push(`footer span ${i + 1} text is "${squash($(span).text())}"`);
    const links = $(span).find('a').toArray().map((a) => [squash($(a).text()), a.attribs.href]);
    if (JSON.stringify(links) !== JSON.stringify([['LICENSE', license], [BUILT_LINK[lang], SITE_REPO]])) problems.push(`footer span ${i + 1} links ${JSON.stringify(links)}`);
  });
  // The spans are the only content and a plain whitespace joins them: the paragraph reads as one line, English text then Turkish text.
  if (squash(paragraph.text()) !== `${FOOTER.en} ${FOOTER.tr}`) problems.push(`the footer paragraph reads "${squash(paragraph.text())}"`);
  // The text of the paragraph equals the two texts and one space, so the one text node between the spans is that space (the check above) and nothing else: no text before, after or twice.
  const between = paragraph.contents().toArray().filter((node) => node.type === 'text').map((node) => node.data);
  if (between.length !== 1) problems.push('the two spans are not joined by plain whitespace alone');
  return problems;
}

/** The rule of every other page (AC-6): the language link to the other language is there and the footer is one paragraph of the language of the page, with no lang of its own. */
function otherPageProblems($, lang, address) {
  const problems = [];
  const link = $('a#b-lang');
  if (link.length !== 1) problems.push('the language link is missing');
  else if (link.attr('href') !== switcherTarget(address).href) problems.push(`the language link goes to ${link.attr('href')}`);
  if ($('footer').length !== 1) problems.push('the page does not hold one footer');
  if ($('footer p').length !== 1) problems.push(`the footer holds ${$('footer p').length} paragraphs`);
  else {
    if (squash($('footer p').text()) !== FOOTER[lang]) problems.push('the footer text is not the one of the page language');
    if ($('footer p').attr('lang') !== undefined) problems.push('the footer paragraph carries a lang of its own');
  }
  return problems;
}

/** The class rule: no stylesheet of its own, no style, only the existing classes, each of them defined in the stylesheet that ships. */
function classProblems($, css, pageSource, styleFiles, linked = true) {
  const problems = [];
  if (/import\s+['"][^'"]*\.css['"]/.test(pageSource)) problems.push('the page file imports a stylesheet');
  for (const file of styleFiles) if (/not-found|404|^nf/.test(file)) problems.push(`src/styles holds ${file}`);
  if (linked && $('link[rel~="stylesheet"]').length !== 1) problems.push(`the page links ${$('link[rel~="stylesheet"]').length} stylesheets`);
  if ($('style').length > 0 || $('[style]').length > 0) problems.push('the page holds a style element or attribute');
  const used = new Set($('main [class]').toArray().flatMap((el) => el.attribs.class.split(/\s+/).filter(Boolean)));
  for (const name of used) {
    if (!CLASSES.includes(name)) problems.push(`the page uses the class ${name}`);
    if (!new RegExp(`\\.${name}(?![\\w-])`).test(css)) problems.push(`the class ${name} is not in the stylesheet`);
  }
  for (const name of ['gs', 'gs-col', 'gs-h1', 'gs-h2', 'gs-p', 'gs-part', 'grid', 'wrap']) if (!used.has(name)) problems.push(`the page does not use the class ${name}`);
  return problems;
}

// ---- hooks --------------------------------------------------------------------------------------------------------------------------------------------------

const built = { parent: '', outDir: '', status: -1, output: '' };
const rendered = {};
const components = { header: {}, footer: {}, base: {} };
let renderer;
let linkCheck = { status: -1, stdout: '' };
let pin = { commit: '' };

/** The environment of an indexable build: the inherited one without the indexing variables, VERCEL_ENV=production. */
function productionEnv() {
  const env = { ...process.env };
  for (const key of ENV_KEYS) delete env[key];
  env.VERCEL_ENV = 'production';
  return env;
}

/** One production-mode Vite server and one Astro container; the page file and the components are loaded through the server. */
async function openRenderer() {
  const config = await getViteConfig({}, { root, devToolbar: { enabled: false } })({ command: 'serve', mode: 'production' });
  const server = await createServer({ ...config, root, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
  const container = await AstroContainer.create();
  const { index } = await server.ssrLoadModule('/src/lib/translations.ts');
  const component = async (path) => (await server.ssrLoadModule(`/${path}`)).default;
  return {
    /** The html of the page FILE with `pairs` as the registered page pairs of the translation index (the real ones when not given). */
    async renderPage(pairs) {
      const { default: Page } = await server.ssrLoadModule(`/${PAGE_FILE}`);
      const before = index.pairs;
      if (pairs !== undefined) index.pairs = pairs;
      try {
        return await container.renderToString(Page);
      } finally {
        index.pairs = before;
      }
    },
    async renderHeader(path) {
      return container.renderToString(await component('src/components/marketing/Header.astro'), { props: { path } });
    },
    async renderFooter(props) {
      return container.renderToString(await component('src/components/marketing/Footer.astro'), { props });
    },
    async renderBase(path) {
      const lead = 'This address does not exist.';
      return container.renderToString(await component('src/layouts/Base.astro'), { props: { path, title: { kind: 'site', text: 'Probe' }, lead }, slots: { default: '<p>probe</p>' } });
    },
    async close() {
      await server[Symbol.for('astro.devServerAppReady')];
      await server.close();
    },
  };
}

// The registered pair lists the page is rendered with: the real ones, the docs pair added, the docs pair first in the list, the docs pair alone, one half of the docs pair, no pair at all.
const STATES = {
  real: undefined,
  docs: [...PAIRS, DOCS_PAIR],
  docsFirst: [DOCS_PAIR, ...[...PAIRS].reverse()],
  docsAlone: [DOCS_PAIR],
  englishHalf: [...PAIRS, { en: '/docs/', tr: '/tr/other-docs/' }],
  turkishHalf: [...PAIRS, { en: '/other-docs/', tr: '/tr/docs/' }],
  none: [],
};
// The pair list each state registers (the real one for `real`), and whether it holds the docs pair.
const POOL = { real: PAIRS, ...Object.fromEntries(Object.entries(STATES).filter(([name]) => name !== 'real')) };
const HAS_DOCS = Object.fromEntries(Object.entries(POOL).map(([name, pairs]) => [name, registered(pairs)]));

before(async () => {
  // The pinned documents come first: the home pages read the pin facts while the build runs.
  const fetched = spawnSync(process.execPath, [join(root, 'scripts', 'sync.mjs'), 'fetch'], { cwd: root, encoding: 'utf8', timeout: 120000 });
  assert.equal(fetched.status, 0, `the fetch of the pinned documents exits 0: ${(fetched.stdout ?? '') + (fetched.stderr ?? '')}`.slice(-400));
  pin = JSON.parse(readFileSync(join(root, 'sync', 'pin.json'), 'utf8'));
  // The output folder is inside the repository (the git-ignored .cache folder): a folder of its own per run has no state shared with the other test files.
  mkdirSync(join(root, '.cache'), { recursive: true });
  built.parent = mkdtempSync(join(root, '.cache', 'proofline-site-'));
  built.outDir = join(built.parent, 'dist');
  const r = spawnSync(process.execPath, [join(root, 'node_modules', 'astro', 'bin', 'astro.mjs'), 'build', '--outDir', built.outDir], { cwd: root, encoding: 'utf8', env: productionEnv(), timeout: 120000 });
  built.status = r.status;
  built.output = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  if (built.status === 0) {
    const links = spawnSync(process.execPath, [join(root, 'scripts', 'check-dist.mjs'), 'links', built.outDir], { cwd: root, encoding: 'utf8' });
    linkCheck = { status: links.status, stdout: links.stdout ?? '' };
  }

  renderer = await openRenderer();
  for (const [name, pairs] of Object.entries(STATES)) rendered[name] = await renderer.renderPage(pairs);
  for (const path of ['/404.html', '/', '/tr/', '/get-started/', '/tr/baslarken/', '/docs/', '/tr/docs/', '/404/', '/tr/404.html', '/x/404.html', '/other/']) components.header[path] = await renderer.renderHeader(path);
  for (const [name, props] of Object.entries({ en: { lang: 'en' }, tr: { lang: 'tr' }, enBoth: { lang: 'en', bilingual: true }, trBoth: { lang: 'tr', bilingual: true }, enOff: { lang: 'en', bilingual: false } })) {
    components.footer[name] = await renderer.renderFooter(props);
  }
  for (const path of ['/404.html', '/other/', '/tr/other/', '/404/', '/tr/404.html', '/get-started/']) components.base[path] = await renderer.renderBase(path);
}, { timeout: 240000 });

after(async () => {
  if (renderer) await renderer.close();
  if (built.parent !== '') rmSync(built.parent, { recursive: true, force: true });
});

/** The built page of the real build, parsed; fails the test when the build did not produce it. */
function page(rel) {
  assert.equal(built.status, 0, `the private build exits 0: ${built.output.slice(-400)}`);
  const file = join(built.outDir, rel);
  assert.ok(existsSync(file), `${rel} is built`);
  return load(readFileSync(file, 'utf8'));
}

const notFoundHtml = () => readFileSync(join(built.outDir, '404.html'), 'utf8');
/** A copy of the real built page, changed by `change`, for a probe. */
function probe(change, html = notFoundHtml()) {
  const $ = load(html);
  change($);
  return $;
}
const fragment = (html) => load(html, null, false);

// ---- AC-1 ---------------------------------------------------------------------------------------------------------------------------------------------------

it('not found: dist holds exactly one 404.html and no 404 folder or Turkish 404 file', () => {
  assert.equal(built.status, 0, `the private build exits 0: ${built.output.slice(-400)}`);
  const files = walk(built.outDir);
  const sources = walk(join(root, 'src', 'pages'));
  assert.deepEqual(fileProblems(files, sources), [], 'the build and the sources hold one not-found page');
  assert.equal(files.filter((file) => file === '404.html').length, 1);
  assert.equal(existsSync(join(built.outDir, '404', 'index.html')), false, 'no 404/index.html');
  assert.equal(existsSync(join(built.outDir, 'tr', '404.html')), false, 'no tr/404.html');
  assert.equal(existsSync(join(built.outDir, 'tr', '404', 'index.html')), false, 'no tr/404/index.html');
  assert.equal(existsSync(join(root, 'src', 'pages', 'tr', '404.astro')), false, 'no Turkish page file');
  assert.ok(existsSync(join(root, PAGE_FILE)), 'the one page file keeps its name');
  // The rule itself: each file that should not be there is a problem naming it, and the good lists have none.
  const good = ['404.html', 'index.html', 'tr/index.html', 'get-started/index.html'];
  assert.deepEqual(fileProblems(good, ['404.astro', 'index.astro', 'tr/index.astro']), []);
  for (const extra of ['404/index.html', 'tr/404.html', 'tr/404/index.html', 'docs/404.html', '404.html.map']) {
    assert.ok(fileProblems([...good, extra], ['404.astro']).includes(`the build holds ${extra}`), `${extra} in the build is a problem`);
  }
  assert.ok(fileProblems(good.slice(1), ['404.astro']).includes('404.html is missing from the build'), 'a missing 404.html is a problem');
  for (const extra of ['tr/404.astro', '404/index.astro', '404.md']) {
    assert.ok(fileProblems(good, ['404.astro', extra]).includes(`src/pages holds ${extra}`), `${extra} in the sources is a problem`);
  }
  assert.ok(fileProblems(good, ['index.astro']).includes('src/pages holds no 404.astro'), 'a missing page file is a problem');
});

// ---- AC-2 ---------------------------------------------------------------------------------------------------------------------------------------------------

it('not found: one English block and one Turkish block, each with its own lang and heading, neither text inside an element of the other language', () => {
  const $ = page('404.html');
  assert.deepEqual(structureProblems($), [], 'the built page');
  for (const [name, html] of Object.entries(rendered)) assert.deepEqual(structureProblems(load(html)), [], `the page file rendered with the ${name} pairs`);
  // The Turkish letters are kept as written, in the page and in its source.
  assert.equal(squash($('main [lang="tr"] h2').text()), 'Sayfa bulunamadı');
  assert.equal($('main [lang="tr"] h2').prop('tagName'), 'H2');
  assert.equal($('main [lang="en"] h1').prop('tagName'), 'H1');
  // The rule itself: each broken rule is found.
  const found = (change, pattern) => assert.ok(structureProblems(probe(change)).some((problem) => pattern.test(problem)), `a probe is found: ${pattern}`);
  found(($$) => $$('main [lang="tr"]').removeAttr('lang'), /blocks with lang="tr"/);
  found(($$) => $$('main [lang="en"]').removeAttr('lang'), /blocks with lang="en"/);
  found(($$) => $$('main [lang="tr"]').attr('lang', 'en'), /2 blocks with lang="en"/);
  found(($$) => $$('html').attr('lang', 'tr'), /html element/);
  found(($$) => $$('main [lang="tr"] h2').replaceWith('<h1>Sayfa bulunamadı</h1>'), /H1 elements|holds an H1/);
  found(($$) => $$('main [lang="tr"] h2').replaceWith('<h3>Sayfa bulunamadı</h3>'), /no H2/);
  found(($$) => $$('main [lang="tr"] h2').text('Sayfa bulunamadi'), /no H2 with its heading/);
  found(($$) => $$('main [lang="en"] h1').text('Not found'), /no H1 "Page not found"/);
  found(($$) => $$('main [lang="en"] h1').replaceWith('<h2>Page not found</h2>'), /H1 elements|no H1/);
  found(($$) => $$('main [lang="tr"]').append('<h2>Başka</h2>'), /heading other than its H2/);
  found(($$) => $$('main [lang="en"]').append('<h2>Other</h2>'), /heading other than its H1/);
  found(($$) => $$('main [lang="en"] h1').wrapInner('<span lang="tr"></span>'), /holds an element with its own lang|elements with a lang/);
  found(($$) => $$('main [lang="tr"] p').first().wrapInner('<span lang="en"></span>'), /holds an element with its own lang|elements with a lang/);
  found(($$) => $$('main [lang="en"]').append($$('main [lang="tr"]')), /holds an element with its own lang|sits inside an element with a lang/);
  found(($$) => $$('main [lang="en"]').wrap('<div lang="tr"></div>'), /sits inside an element with a lang|elements with a lang/);
  found(($$) => $$('main').append('<p>stray text</p>'), /outside both blocks/);
  found(($$) => $$('main [lang="tr"] p').first().text('Bu adres yok.'), /lacks its sentence/);
  found(($$) => $$('main [lang="en"] p').first().text('No such address.'), /lacks its sentence/);
  found(($$) => $$('main').append('<h1>Another</h1>'), /H1 elements/);
});

// ---- AC-3 ---------------------------------------------------------------------------------------------------------------------------------------------------

it('not found: the home links always point to existing targets and the docs links appear exactly when the docs pair is registered', () => {
  const $ = page('404.html');
  // The real build links the two home pages, and the docs pages exactly when the docs pair is registered (today it is not); every target exists and the link check of the site passes on it.
  const docsToday = HAS_DOCS.real;
  assert.deepEqual(linksOf($), { en: docsToday ? [HOME.en, DOCS.en] : [HOME.en], tr: docsToday ? [HOME.tr, DOCS.tr] : [HOME.tr] }, 'the real build holds the home links, and the docs links when the pair is registered');
  assert.deepEqual(linkProblems($, docsToday, built.outDir), []);
  assert.equal(linkCheck.status, 0, `the link check of the build exits 0: ${linkCheck.stdout.slice(-300)}`);
  assert.equal($('main a[href^="/docs/"], main a[href^="/tr/docs/"]').length, docsToday ? 2 : 0, 'the docs links follow the registered docs pair');
  assert.ok(existsSync(join(built.outDir, 'index.html')) && existsSync(join(built.outDir, 'tr', 'index.html')), 'both home targets exist');
  // The page file rendered with each registered pair list: the docs links appear exactly when the pair of both addresses is registered, after the home link.
  for (const [name, html] of Object.entries(rendered)) {
    const $$ = load(html);
    assert.deepEqual(linkProblems($$, HAS_DOCS[name]), [], `the page file rendered with the ${name} pairs`);
  }
  assert.deepEqual(linksOf(load(rendered.docs)), { en: [HOME.en, DOCS.en], tr: [HOME.tr, DOCS.tr] }, 'with the docs pair: four links, two to a block, home first');
  assert.deepEqual(linksOf(load(rendered.real)), linksOf($), 'the page file rendered with the real pairs links as the build does');
  assert.deepEqual(linksOf(load(rendered.docsFirst)), linksOf(load(rendered.docs)), 'the order of the registered pairs does not change the links');
  assert.deepEqual(linksOf(load(rendered.docsAlone)), linksOf(load(rendered.docs)), 'the docs pair alone still lists the home links first');
  assert.deepEqual(linksOf(load(rendered.none)), { en: [HOME.en], tr: [HOME.tr] }, 'no pair at all: the home links only');
  assert.deepEqual(linksOf(load(rendered.englishHalf)).en, [HOME.en], 'only the English half of the pair: no docs link');
  assert.deepEqual(linksOf(load(rendered.turkishHalf)).tr, [HOME.tr], 'only the Turkish half of the pair: no docs link');
  // The rule itself.
  const problems = (change, docs, outDir = null) => linkProblems(probe(change), docs, outDir);
  assert.ok(problems(($$) => $$('main [lang="en"] a').attr('href', '/tr/'), false).length > 0, 'a wrong English target is found');
  assert.ok(problems(($$) => $$('main [lang="tr"] a').attr('href', '/'), false).length > 0, 'a wrong Turkish target is found');
  assert.ok(problems(($$) => $$('main [lang="tr"] a').text('Home'), false).length > 0, 'a wrong Turkish text is found');
  assert.ok(problems(($$) => $$('main [lang="en"]').append('<p><a href="/docs/">Docs</a></p>'), false).length > 0, 'a docs link without its pair is found');
  assert.ok(problems(($$) => $$('main [lang="en"] a').remove(), false).length > 0, 'a block without its home link is found');
  assert.ok(problems(() => {}, true).length > 0, 'a missing docs link is found when the pair is registered');
  const homes = makeTempDir('proofline-site-');
  mkdirSync(join(homes, 'tr'), { recursive: true });
  writeFileSync(join(homes, 'index.html'), '<p>home</p>');
  writeFileSync(join(homes, 'tr', 'index.html'), '<p>ana</p>');
  assert.deepEqual(linkProblems(load(rendered.none), false, homes), [], 'the two home pages are the targets of the home links');
  assert.deepEqual(linkProblems(load(rendered.docs), true, homes).sort(), ['/docs/ does not exist in the build', '/tr/docs/ does not exist in the build'], 'a docs link to a page that is not built is found');
  assert.ok(problems(($$) => $$('main').append('<p><a href="/">Home</a></p>'), false).length > 0, 'a link outside the blocks is found');
});

// ---- AC-4 ---------------------------------------------------------------------------------------------------------------------------------------------------

it('not found: no hreflang, no canonical, no refresh, no redirect and no script element', () => {
  const html = notFoundHtml();
  assert.deepEqual(headProblems(load(html), html), [], 'the built page');
  for (const [name, state] of Object.entries(rendered)) assert.deepEqual(headProblems(load(state), state), [], `the page file rendered with the ${name} pairs`);
  assert.equal(controlsScript('/404.html'), false, 'the page loads no controls script');
  // The rule itself: each broken rule is found.
  const found = (change, pattern) => {
    const $$ = probe(change);
    assert.ok(headProblems($$, $$.html()).some((problem) => pattern.test(problem)), `a probe is found: ${pattern}`);
  };
  found(($$) => $$('head').append('<link rel="alternate" hreflang="tr" href="https://proofline.technology/tr/">'), /hreflang/);
  found(($$) => $$('head').append('<link rel="alternate" href="https://proofline.technology/tr/">'), /alternate/);
  found(($$) => $$('head').append('<link rel="canonical" href="https://proofline.technology/404.html">'), /canonical/);
  found(($$) => $$('head').append('<meta http-equiv="refresh" content="0; url=/">'), /http-equiv/);
  found(($$) => $$('head').append('<meta http-equiv="Refresh" content="5; url=/tr/">'), /redirect|http-equiv/);
  found(($$) => $$('head').append('<script src="/assets/controls.js"></script>'), /script elements/);
  found(($$) => $$('body').append('<script>window.location.replace("/")</script>'), /redirect/);
  found(($$) => $$('body').append('<noscript>x</noscript>'), /noscript/);
});

// ---- AC-5 ---------------------------------------------------------------------------------------------------------------------------------------------------

it('not found: the title and og:title equal the English title and carry no evidence word', () => {
  const $ = page('404.html');
  assert.deepEqual(titleProblems($), [], 'the built page');
  assert.equal($('title').text(), TITLE);
  assert.equal($('meta[property="og:title"]').attr('content'), TITLE);
  assert.equal($('title').text().includes('Sayfa'), false, 'the old two-language title is gone');
  assert.notEqual($('title').text(), OLD_TITLE);
  assert.equal($('meta[name="description"]').attr('content'), `${SENTENCE.en} ${PHRASE}.`, 'the description is the lead and the English suffix');
  assert.equal(Array.from($('meta[name="description"]').attr('content')).length >= 70, true);
  for (const [name, html] of Object.entries(rendered)) assert.deepEqual(titleProblems(load(html)), [], `the page file rendered with the ${name} pairs`);
  // The rule itself.
  const found = (change, pattern) => assert.ok(titleProblems(probe(change)).some((problem) => pattern.test(problem)), `a probe is found: ${pattern}`);
  found(($$) => $$('title').text(OLD_TITLE), /the title is/);
  found(($$) => $$('title').text('Page not found | proofline: Claude Code ve Codex için deterministik bir mühendislik ekibi'), /the title is/);
  found(($$) => $$('meta[property="og:title"]').attr('content', 'Page not found'), /og:title is/);
  found(($$) => { $$('title').text(`Evidence | ${PHRASE}`); $$('meta[property="og:title"]').attr('content', `Evidence | ${PHRASE}`); }, /evidence word/);
  found(($$) => { $$('title').text(`Kanıt | ${PHRASE}`); $$('meta[property="og:title"]').attr('content', `Kanıt | ${PHRASE}`); }, /evidence word/);
  found(($$) => { $$('title').text(`KANIT | ${PHRASE}`); $$('meta[property="og:title"]').attr('content', `KANIT | ${PHRASE}`); }, /evidence word/);
  found(($$) => $$('meta[name="description"]').attr('content', 'Too short.'), /the description is 10 characters/);
  found(($$) => $$('meta[name="description"]').attr('content', `${'x'.repeat(100)} ${PHRASE}.`), /the description is "/);
  found(($$) => $$('meta[property="og:description"]').attr('content', 'other'), /og:description/);
});

// ---- AC-6 ---------------------------------------------------------------------------------------------------------------------------------------------------

it('not found: the header has brand, menu, GitHub link and theme button and no language link, and the footer holds the N-3 line in both languages', async () => {
  const license = `${REPO}/blob/${pin.commit}/LICENSE`;
  const $ = page('404.html');
  assert.deepEqual(headerProblems($, expectedMenu(PAIRS)), [], 'the header of the built page');
  assert.deepEqual(footerProblems($, license), [], 'the footer of the built page');
  for (const [name, html] of Object.entries(rendered)) {
    // The header menu lists the entries whose pair is registered, so a state with no pair or with the docs pair alone has a menu of its own; the other rules are the same.
    const menu = expectedMenu(POOL[name]);
    const $$ = load(html);
    assert.equal($$('#b-lang').length, 0, `the page file rendered with the ${name} pairs prints no language link`);
    assert.equal($$('button#b-theme').length, 1, `the page file rendered with the ${name} pairs prints the theme button`);
    assert.deepEqual($$('header nav a').toArray().map((a) => [a.attribs.href, squash($$(a).text())]), menu, `the menu of the page file rendered with the ${name} pairs`);
    assert.deepEqual(footerProblems($$, license), [], `the footer of the page file rendered with the ${name} pairs`);
    if (menu.length > 0) assert.deepEqual(headerProblems($$, menu), [], `the header of the page file rendered with the ${name} pairs`);
  }
  assert.equal($('a#b-lang').length, 0, 'no language link on the page');
  assert.equal($('button#b-theme').length, 1, 'the theme button is there');

  // The header of the component: the language link is left out exactly for the address of the not-found page, and kept for every other address.
  assert.equal(fragment(components.header['/404.html'])('a#b-lang').length, 0, '/404.html: no language link');
  for (const path of ['/', '/tr/', '/get-started/', '/tr/baslarken/', '/docs/', '/tr/docs/', '/404/', '/tr/404.html', '/x/404.html', '/other/']) {
    const link = fragment(components.header[path])('a#b-lang');
    assert.equal(link.length, 1, `${path}: the language link is kept`);
    assert.equal(link.attr('href'), switcherTarget(path).href, `${path}: it goes to the other language`);
  }
  for (const path of Object.keys(components.header)) {
    assert.equal(fragment(components.header[path])('header a.brand').length, 1, `${path}: the brand is there`);
    assert.equal(fragment(components.header[path])('button#b-theme').length, 1, `${path}: the theme button is there`);
    assert.equal(fragment(components.header[path])('a#b-gh').length, 1, `${path}: the GitHub link is there`);
  }

  // The footer of the component: ONE paragraph holding an English span then a Turkish span, each with its own lang, for the bilingual variant of either page language
  // (the page language does not change it); one paragraph with no span and no lang otherwise.
  for (const name of ['enBoth', 'trBoth']) {
    const $$ = fragment(components.footer[name]);
    assert.deepEqual(footerProblems(load(`<html><body><header></header><main></main>${components.footer[name]}</body></html>`), `${REPO}/blob/${pin.commit}/LICENSE`), [], `${name}: one paragraph, two spans`);
    assert.equal($$('footer').length, 1, `${name}: one footer`);
    assert.equal($$('footer p').length, 1, `${name}: one paragraph`);
    assert.deepEqual($$('footer p span').toArray().map((span) => [span.attribs.lang, squash($$(span).text())]), [['en', FOOTER.en], ['tr', FOOTER.tr]], `${name}: the English span, then the Turkish span`);
    assert.equal($$('footer p').attr('lang'), undefined, `${name}: the paragraph has no lang of its own`);
  }
  assert.equal(components.footer.enBoth, components.footer.trBoth, 'the bilingual footer does not depend on the page language');
  for (const [name, lang] of [['en', 'en'], ['tr', 'tr'], ['enOff', 'en']]) {
    const $$ = fragment(components.footer[name]);
    assert.equal($$('footer p').length, 1, `${name}: one paragraph`);
    assert.equal(squash($$('footer p').text()), FOOTER[lang], `${name}: the text of its language`);
    assert.equal($$('footer p').attr('lang'), undefined, `${name}: no lang of its own`);
    assert.equal($$('footer [lang], footer span').length, 0, `${name}: no span and no lang inside`);
  }
  assert.equal(components.footer.en, components.footer.enOff, 'bilingual false is the default');

  // The layout selects the variant by the address: the not-found address only.
  const footerOf = (path) => { const $$ = load(components.base[path]); return { paragraphs: $$('footer p').length, paragraphLang: $$('footer p').attr('lang'), spans: $$('footer p span').toArray().map((span) => [span.attribs.lang, squash($$(span).text())]), text: squash($$('footer p').text()) }; };
  assert.deepEqual(footerOf('/404.html'), { paragraphs: 1, paragraphLang: undefined, spans: [['en', FOOTER.en], ['tr', FOOTER.tr]], text: `${FOOTER.en} ${FOOTER.tr}` }, '/404.html: the bilingual footer, one paragraph');
  for (const [path, lang] of [['/other/', 'en'], ['/get-started/', 'en'], ['/404/', 'en'], ['/tr/other/', 'tr'], ['/tr/404.html', 'tr']]) {
    assert.deepEqual(footerOf(path), { paragraphs: 1, paragraphLang: undefined, spans: [], text: FOOTER[lang] }, `${path}: the one-language footer`);
  }
  assert.equal(load(components.base['/404.html'])('a#b-lang').length, 0, '/404.html: the layout prints no language link');
  for (const path of ['/other/', '/tr/other/', '/404/', '/tr/404.html', '/get-started/']) assert.equal(load(components.base[path])('a#b-lang').length, 1, `${path}: the layout keeps the language link`);

  // Every other page keeps its language link and its one-language footer.
  for (const [lang, rel, address] of OTHER_PAGES) assert.deepEqual(otherPageProblems(page(rel), lang, address), [], `${rel} keeps its language link and its footer`);

  // The rules themselves: each broken rule is found.
  const header = (change, pattern) => assert.ok(headerProblems(probe(change), expectedMenu(PAIRS)).some((problem) => pattern.test(problem)), `a header probe is found: ${pattern}`);
  header(($$) => $$('.tools').prepend('<a class="tool" id="b-lang" href="/tr/" lang="tr" hreflang="tr" aria-label="TR: read this page in Turkish">TR</a>'), /language link/);
  header(($$) => $$('a#b-gh').remove(), /header order/);
  header(($$) => $$('button#b-theme').remove(), /header order|theme button/);
  header(($$) => $$('header nav a').last().remove(), /menu entries|header order/);
  header(($$) => $$('a.brand').attr('href', '/tr/'), /brand/);
  header(($$) => $$('a#b-gh').attr('href', 'https://example.com/'), /GitHub/);
  header(($$) => $$('header .tools').append('<span lang="tr">x</span>'), /own lang/);
  header(($$) => $$('main').append('<a hreflang="tr" aria-label="TR: read this page in Turkish" href="/tr/">TR</a>'), /hreflang|names a language link/);
  const footer = (change, pattern) => assert.ok(footerProblems(probe(change), license).some((problem) => pattern.test(problem)), `a footer probe is found: ${pattern}`);
  footer(($$) => $$('footer p span').last().remove(), /not two spans/);
  footer(($$) => $$('footer p').first().after('<p lang="tr">x</p>'), /2 paragraphs/);
  footer(($$) => { const spans = $$('footer p span'); $$('footer').html(`<p lang="en">${$$(spans[0]).html()}</p><p lang="tr">${$$(spans[1]).html()}</p>`); }, /2 paragraphs/);
  footer(($$) => $$('footer p').attr('lang', 'en'), /lang of its own/);
  footer(($$) => $$('footer p span').first().removeAttr('lang'), /not lang="en"|lang attributes of the footer/);
  footer(($$) => $$('footer p span').last().attr('lang', 'en'), /not lang="tr"/);
  footer(($$) => { const spans = $$('footer p span'); $$(spans[0]).attr('lang', 'tr'); $$(spans[1]).attr('lang', 'en'); }, /not lang="en"/);
  footer(($$) => $$('footer p span').first().before($$('footer p span').last()), /not lang="en"/);
  footer(($$) => $$('footer p span').first().after('<span lang="en">third</span>'), /not two spans/);
  footer(($$) => $$('footer p span').last().text('Çerez yok.'), /text is/);
  footer(($$) => $$('footer p span').first().find('a').first().attr('href', 'https://example.com/'), /links/);
  footer(($$) => $$('footer p span').first().after('<br>'), /block-level element or a break/);
  footer(($$) => $$('footer p span').first().append('<div>x</div>'), /block-level element or a break/);
  footer(($$) => $$('footer p span').first().wrap('<div></div>'), /block-level element or a break/);
  footer(($$) => $$('footer p span').first().after('<em lang="fr"></em>'), /not two spans/);
  footer(($$) => $$('footer p').empty().append($$('<span lang="en"></span>')).append($$('<span lang="tr"></span>')), /text is/);
  footer(($$) => $$('footer p span').first().after('·'), /plain whitespace/);
  footer(($$) => $$('footer p').prepend(' '), /plain whitespace/);
  footer(($$) => $$('footer p').html($$('footer p').html().replace('</span> <span', '</span><span')), /plain whitespace/);
  footer(($$) => $$('footer p span').first().after('<span> </span>'), /not two spans/);
  footer(($$) => $$('footer').append('<footer></footer>'), /2 footers/);
  footer(($$) => $$('footer').append('<div></div>'), /besides the paragraph/);
  footer(($$) => $$('main').append($$('footer')), /inside main|body is not/);
  const other = (change, lang, address, pattern) => assert.ok(otherPageProblems(probe(change, readFileSync(join(built.outDir, address === '/' ? 'index.html' : `${address.slice(1)}index.html`), 'utf8')), lang, address).some((problem) => pattern.test(problem)), `an other-page probe is found: ${pattern}`);
  other(($$) => $$('a#b-lang').remove(), 'en', '/', /language link is missing/);
  other(($$) => $$('a#b-lang').attr('href', '/'), 'en', '/', /language link goes to/);
  other(($$) => $$('footer p').after('<p lang="tr">x</p>'), 'en', '/', /2 paragraphs/);
  other(($$) => $$('footer p').attr('lang', 'en'), 'en', '/', /lang of its own/);
  other(($$) => $$('footer p').text('Other.'), 'tr', '/tr/', /footer text/);
});

// ---- AC-7 ---------------------------------------------------------------------------------------------------------------------------------------------------

it('not found: the local server answers an unknown path with status 404 and the body of 404.html', async () => {
  assert.equal(built.status, 0, `the private build exits 0: ${built.output.slice(-400)}`);
  const body = notFoundHtml();
  const server = await startServer({ root: built.outDir });
  try {
    for (const path of ['/old-page/', '/old-page/deeper/', '/tr/eski-sayfa/']) {
      const response = await raw(server.url, path);
      assert.equal(response.status, 404, `${path} answers 404`);
      assert.equal(response.body, body, `${path} answers the body of 404.html`);
      assert.match(String(response.headers['content-type']), /^text\/html/, `${path} answers html`);
    }
    const home = await raw(server.url, '/');
    assert.equal(home.status, 200, 'the home page is not a 404');
    assert.notEqual(home.body, body, 'the home page is not the 404 body');
  } finally {
    await server.close();
  }
  // The comparison is real: a build with no 404.html answers 404 with another body, and a body that differs from the page is found.
  const bare = makeTempDir('proofline-site-');
  writeFileSync(join(bare, 'index.html'), '<p>home</p>');
  const empty = await startServer({ root: bare });
  try {
    const response = await raw(empty.url, '/old-page/');
    assert.equal(response.status, 404);
    assert.notEqual(response.body, body, 'a tree with no 404.html does not answer the page');
  } finally {
    await empty.close();
  }
});

// ---- AC-8 ---------------------------------------------------------------------------------------------------------------------------------------------------

it('not found: the page is one page and every block has its home link and its own lang', () => {
  const files = walk(built.outDir);
  assert.deepEqual(fileProblems(files, walk(join(root, 'src', 'pages'))), [], 'one page: no second not-found file');
  const html = notFoundHtml();
  assert.deepEqual(homeProblems(load(html)), [], 'the built page');
  assert.deepEqual(headProblems(load(html), html), [], 'the page does not redirect');
  for (const [name, state] of Object.entries(rendered)) {
    assert.deepEqual(homeProblems(load(state)), [], `the page file rendered with the ${name} pairs`);
    if (HAS_DOCS[name]) {
      for (const lang of ['en', 'tr']) assert.equal(load(state)(`main [lang="${lang}"] a[href="${DOCS[lang][0]}"]`).length, 1, `${name}: the ${lang} block has its docs link`);
    }
  }
  for (const lang of ['en', 'tr']) assert.equal(page('404.html')(`main [lang="${lang}"]`).length, 1, `one ${lang} block`);
  // The rule itself.
  const found = (change, pattern) => assert.ok(homeProblems(probe(change)).some((problem) => pattern.test(problem)), `a probe is found: ${pattern}`);
  found(($$) => $$('main [lang="tr"]').removeAttr('lang'), /no single block with lang="tr"/);
  found(($$) => $$('main [lang="en"]').removeAttr('lang'), /no single block with lang="en"/);
  found(($$) => $$('main [lang="tr"] a').remove(), /no link to \/tr\//);
  found(($$) => $$('main [lang="en"] a').attr('href', '/tr/'), /no link to \//);
  found(($$) => $$('main [lang="tr"] a').attr('href', '/'), /no link to \/tr\//);
});

// ---- the helper ---------------------------------------------------------------------------------------------------------------------------------------------

it('not found: notFoundLinks lists the home links always and the docs links only for a registered docs pair', () => {
  const home = { en: { href: '/', label: 'Home' }, tr: { href: '/tr/', label: 'Ana sayfa' } };
  const docs = { en: { href: '/docs/', label: 'Docs' }, tr: { href: '/tr/docs/', label: 'Belgeler' } };
  const homeOnly = { en: [home.en], tr: [home.tr] };
  const both = { en: [home.en, docs.en], tr: [home.tr, docs.tr] };
  assert.deepEqual(DOCS_PAIR, { en: '/docs/', tr: '/tr/docs/' }, 'the docs pair is the pair of the two docs indexes');
  assert.deepEqual(notFoundLinks([]), homeOnly, 'no pair: the home links only');
  assert.deepEqual(notFoundLinks(PAIRS), homeOnly, 'the real pairs hold no docs pair');
  assert.deepEqual(notFoundLinks(), homeOnly, 'with no list it reads the registered pairs of the site');
  assert.deepEqual(notFoundLinks([...PAIRS, DOCS_PAIR]), both, 'the docs pair added: home then docs, in both languages');
  assert.deepEqual(notFoundLinks([DOCS_PAIR, ...PAIRS]), both, 'the docs pair first in the list: the order stays home then docs');
  assert.deepEqual(notFoundLinks([DOCS_PAIR]), both, 'the docs pair alone: the home links are still listed');
  assert.deepEqual(notFoundLinks([{ en: '/docs/', tr: '/tr/other-docs/' }]), homeOnly, 'only the English address of the pair: no docs link');
  assert.deepEqual(notFoundLinks([{ en: '/other-docs/', tr: '/tr/docs/' }]), homeOnly, 'only the Turkish address of the pair: no docs link');
  assert.deepEqual(notFoundLinks([{ en: '/docs/', tr: '/tr/docs/' }, { en: '/docs/', tr: '/tr/guven/' }]), both, 'a later pair that shares one address does not hide the pair');
  assert.deepEqual(notFoundLinks([{ en: '/docs/guide/', tr: '/tr/docs/guide/' }]), homeOnly, 'a page under the docs is not the docs index');
  assert.deepEqual(notFoundLinks([{ en: '/trust/', tr: '/tr/docs/' }, { en: '/docs/', tr: '/tr/guven/' }]), homeOnly, 'the two addresses in two different pairs are not the docs pair');
  const list = [...PAIRS, DOCS_PAIR];
  const copy = JSON.stringify(list);
  notFoundLinks(list);
  assert.equal(JSON.stringify(list), copy, 'the list is not changed');
  assert.equal(Object.keys(notFoundLinks([])).join(), 'en,tr', 'the result names the two languages');
  assert.notEqual(notFoundLinks([]).en[0].label, notFoundLinks([]).tr[0].label, 'each language has its own link text');
});

// ---- every prop of the page file --------------------------------------------------------------------------------------------------------------------------

it('not found: every prop of the page file is passed and observed', () => {
  const source = read(PAGE_FILE);
  const bases = propsOf(source, 'Base');
  assert.equal(bases.length, 1, 'one Base element');
  assert.deepEqual(bases[0], { path: '"/404.html"', title: "{{ kind: 'site', text: NOT_FOUND_TEXT.en.heading }}", lead: '{NOT_FOUND_TEXT.en.sentence}' }, 'the props of Base');
  assert.deepEqual(propsOf(source, 'section'), [{ lang: '"en"', class: '"gs-part"' }, { lang: '"tr"', class: '"gs-part"' }], 'the props of the two blocks');
  assert.deepEqual(propsOf(source, 'h1'), [{ class: '"gs-h1"' }], 'the props of the H1');
  assert.deepEqual(propsOf(source, 'h2'), [{ class: '"gs-h2"' }], 'the props of the H2');
  assert.deepEqual(propsOf(source, 'p'), [{ class: '"gs-p"' }, { class: '"gs-p"' }, { class: '"gs-p"' }, { class: '"gs-p"' }], 'the props of the paragraphs');
  assert.deepEqual(propsOf(source, 'a'), [{ href: '{link.href}' }, { href: '{link.href}' }], 'the props of the links');
  assert.deepEqual(propsOf(source, 'div'), [{ class: '"wrap gs"' }, { class: '"grid"' }, { class: '"gs-col"' }], 'the props of the layout elements');
  assert.match(source, /^const links = notFoundLinks\(\);$/m, 'the links come from the helper');
  assert.match(source, /import \{ NOT_FOUND_TEXT, notFoundLinks \} from '\.\.\/lib\/not-found\.ts';/, 'the helper is imported');
  // The element reader itself: an extra prop, a string prop and an expression with a brace and a quote inside are all read.
  assert.deepEqual(propsOf("<Base a=\"x y\" b={{ k: 'v}', n: 1 }} c={z}>\n</Base>", 'Base'), [{ a: '"x y"', b: "{{ k: 'v}', n: 1 }}", c: '{z}' }], 'the reader keeps every prop as written');
  assert.deepEqual(propsOf('<section lang="en" />', 'Base'), [], 'another element is not read');

  // Each prop is observed, by rendering the real page file (with the docs pair, so that every link of the page is printed).
  const $ = load(rendered.docs);
  // path: the language of the page, no alternate, no language link, the bilingual footer and no current menu entry follow the not-found address.
  assert.equal($('html').attr('lang'), 'en', 'path decides the language of the page');
  assert.equal($('link[hreflang]').length, 0, 'path decides the alternates: none');
  assert.equal($('a#b-lang').length, 0, 'path decides the language link: none');
  assert.equal($('footer p').length, 1, 'path decides the footer: one paragraph');
  assert.deepEqual($('footer p span').toArray().map((span) => span.attribs.lang), ['en', 'tr'], 'path decides the footer: both languages, English first');
  assert.equal($('header nav a[aria-current]').length, 0, 'path decides the current menu entry: none');
  // title: the page title and the suffix; lead: the description.
  assert.equal($('title').text(), TITLE, 'title decides the head title: the text of the site title kind, then the English suffix');
  assert.equal($('meta[property="og:title"]').attr('content'), TITLE, 'title decides og:title');
  assert.equal($('meta[name="description"]').attr('content'), `${SENTENCE.en} ${PHRASE}.`, 'lead decides the description');
  // section lang and class, h1, h2, p, a href, div classes: the body.
  assert.deepEqual($('main section').toArray().map((el) => [el.attribs.lang, el.attribs.class]), [['en', 'gs-part'], ['tr', 'gs-part']], 'the blocks carry their lang and class');
  assert.equal($('main section[lang="en"] h1').attr('class'), 'gs-h1', 'the H1 carries its class');
  assert.equal($('main section[lang="tr"] h2').attr('class'), 'gs-h2', 'the H2 carries its class');
  assert.equal($('main p').toArray().every((p) => p.attribs.class === 'gs-p'), true, 'every paragraph carries its class');
  assert.equal($('main p').length, 6, 'two sentences and four link paragraphs');
  assert.deepEqual($('main a').toArray().map((a) => [a.attribs.href, squash($(a).text())]), [HOME.en, DOCS.en, HOME.tr, DOCS.tr], 'every link carries the address and the text of the helper');
  assert.deepEqual($('main > div').toArray().map((el) => el.attribs.class), ['wrap gs'], 'the page wrapper');
  assert.equal($('main .wrap.gs > .grid > .gs-col > section').length, 2, 'the blocks sit in the reading column');
  // The texts of the blocks as they are printed, and the Base props that have no other observation: the lead is not printed in the body.
  const blockText = (lang) => $(`main [lang="${lang}"]`).find('h1, h2, p').toArray().map((el) => squash($(el).text())).join(' | ');
  assert.equal(blockText('en'), `${HEADING.en} | ${SENTENCE.en} | Home | Docs`);
  assert.equal(blockText('tr'), `${HEADING.tr} | ${SENTENCE.tr} | Ana sayfa | Belgeler`);
  assert.equal($('main').text().includes(PHRASE), false, 'the suffix of the description is not printed in the body');
  // A source that drops a prop is found: the reader sees a Base element without its lead.
  assert.notDeepEqual(propsOf(source.replace(' lead={NOT_FOUND_TEXT.en.sentence}', ''), 'Base')[0], bases[0], 'a page file without its lead differs');
});

// ---- the classes --------------------------------------------------------------------------------------------------------------------------------------------

it('not found: the page links no stylesheet of its own and uses the existing classes', () => {
  const $ = page('404.html');
  const href = $('link[rel~="stylesheet"]').attr('href');
  assert.ok(href, 'the page links its stylesheet');
  const css = readFileSync(join(built.outDir, href), 'utf8');
  const source = read(PAGE_FILE);
  const files = readdirSync(join(root, 'src', 'styles')).sort();
  assert.deepEqual(classProblems($, css, source, files), []);
  assert.equal(page('index.html')('link[rel~="stylesheet"]').attr('href'), href, 'the stylesheet is the one of every page of the site');
  assert.equal(existsSync(join(root, 'src', 'styles', 'not-found.css')), false, 'no stylesheet of its own');
  assert.equal(/nf-/.test(css), false, 'no rule of a not-found prefix in the stylesheet');
  assert.equal(/not-found\.css|404\.css/.test(read('src/layouts/Base.astro')), false, 'the layout imports no stylesheet of the not-found page');
  for (const html of Object.values(rendered)) assert.deepEqual(classProblems(load(html), css, source, files, false), [], 'every rendered state uses the same classes (the container links no stylesheet)');
  // The rule itself: each broken rule is found.
  const found = (change, pattern, options = {}) => {
    const $$ = probe(change);
    assert.ok(classProblems($$, css, options.source ?? source, options.files ?? files).some((problem) => pattern.test(problem)), `a probe is found: ${pattern}`);
  };
  found(($$) => $$('main section').first().addClass('nf-block'), /uses the class nf-block/);
  found(($$) => $$('main p').first().addClass('home-note'), /uses the class home-note/);
  found(($$) => $$('head').append('<link rel="stylesheet" href="/_astro/not-found.css">'), /2 stylesheets/);
  found(($$) => $$('main p').first().attr('style', 'margin:0'), /style element or attribute/);
  found(($$) => $$('head').append('<style>p{margin:0}</style>'), /style element or attribute/);
  found(($$) => $$('main .gs-col').removeClass('gs-col'), /does not use the class gs-col/);
  found(() => {}, /imports a stylesheet/, { source: `import '../styles/not-found.css';\n${source}` });
  found(() => {}, /src\/styles holds not-found\.css/, { files: [...files, 'not-found.css'].sort() });
  assert.ok(classProblems($, css.replace('.gs-part', '.gs-other'), source, files).some((problem) => /gs-part is not in the stylesheet/.test(problem)), 'a class missing from the stylesheet is found');
});
