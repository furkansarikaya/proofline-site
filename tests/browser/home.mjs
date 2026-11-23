// Browser checks of the home pages (TASK-019): run only by `npm run test:browser`, never by `node --test` discovery (ADR 0009).
// A container render cannot show the bundled stylesheet or the real controls script, so the `before` hook fetches the pinned documents, builds the real site into a
// folder of its own under .cache (not dist/, not the shared .tmp folder) and serves it; Chromium of the Playwright library measures the pages. No sleep: every
// value is read from layout and computed styles.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from '../../scripts/serve-dist.mjs';
import { ENV_KEYS } from '../../src/lib/indexing.ts';
import { removeTempDirs, sweepStale } from '../temp-dirs.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
sweepStale();

const HEIGHT = 900;
const ADDRESS = { en: '/', tr: '/tr/' };
const INSTALL_TEXT = '/plugin marketplace add furkansarikaya/proofline\n/plugin install proofline@proofline';
const DARK_BG = '#0d0f10';
const LIGHT_BG = '#dedad3';

let parent = '';
let outDir = '';
let buildStatus = -1;
let buildOutput = '';
let site;
let browser;

before(async () => {
  const env = { ...process.env };
  for (const key of ENV_KEYS) delete env[key];
  const fetched = spawnSync(process.execPath, [join(root, 'scripts', 'sync.mjs'), 'fetch'], { cwd: root, encoding: 'utf8', env, timeout: 120000 });
  mkdirSync(join(root, '.cache'), { recursive: true });
  parent = mkdtempSync(join(root, '.cache', 'proofline-home-browser-'));
  outDir = join(parent, 'dist');
  const built = fetched.status === 0
    ? spawnSync(process.execPath, [join(root, 'node_modules', 'astro', 'bin', 'astro.mjs'), 'build', '--outDir', outDir], { cwd: root, encoding: 'utf8', env, timeout: 120000 })
    : fetched;
  buildStatus = built.status;
  buildOutput = `${fetched.stdout ?? ''}${fetched.stderr ?? ''}${built.stdout ?? ''}${built.stderr ?? ''}`;
  if (buildStatus === 0) site = await startServer({ root: outDir });
  browser = await chromium.launch();
}, { timeout: 240000 });

after(async () => {
  try {
    await browser?.close();
    await site?.close();
  } finally {
    if (parent !== '') rmSync(parent, { recursive: true, force: true });
    removeTempDirs();
  }
});

/** Open the built home page in a fresh context, run `fn(page)` and always close the context. */
async function withPage({ lang = 'en', width = 1440, scheme = 'light', blockControls = false, need = [] }, fn) {
  assert.equal(buildStatus, 0, `the private build exits 0: ${buildOutput.slice(-400)}`);
  const context = await browser.newContext({ viewport: { width, height: HEIGHT }, colorScheme: scheme, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    if (blockControls) await page.route('**/assets/controls.js', (route) => route.abort());
    await page.goto(`${site.url}${ADDRESS[lang]}`);
    await page.evaluate(() => document.fonts.ready);
    // The elements a test measures must exist: a page without them fails here as a missing element, not as a script error in the measurement.
    const missing = await page.evaluate((selectors) => selectors.filter((s) => document.querySelector(s) === null), need);
    assert.deepEqual(missing, [], `${lang} ${width}: the home page holds the elements to measure`);
    return await fn(page);
  } finally {
    await context.close();
  }
}

/** Box of an element as plain numbers, in the page's coordinate system (scroll offset included). */
const BOX = `(el) => { const r = el.getBoundingClientRect(); return { left: r.left + scrollX, right: r.right + scrollX, top: r.top + scrollY, bottom: r.bottom + scrollY, width: r.width, height: r.height }; }`;

describe('home pages in Chromium', { timeout: 120000 }, () => {
  it('the headline breaks in two lines with the two tones at 1440 pixels', async () => {
    for (const lang of ['en', 'tr']) {
      const m = await withPage({ lang, need: ['h1 .home-h1-a', 'h1 .home-h1-b'] }, (page) => page.evaluate((boxSource) => {
        const box = eval(boxSource);
        const h1 = document.querySelector('h1');
        const a = h1.querySelector('.home-h1-a');
        const b = h1.querySelector('.home-h1-b');
        // The colour a token resolves to: a probe element takes the custom property through the CSSOM and the browser computes it.
        const resolved = (token) => {
          const probe = document.createElement('span');
          probe.style.color = `var(${token})`;
          document.body.append(probe);
          const colour = getComputedStyle(probe).color;
          probe.remove();
          return colour;
        };
        const lineTops = (el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          return [...new Set([...range.getClientRects()].map((r) => Math.round(r.top)))];
        };
        const lineHeight = parseFloat(getComputedStyle(h1).lineHeight);
        return {
          h1: box(h1), a: box(a), b: box(b), lineHeight,
          aLines: lineTops(a).length, bLines: lineTops(b).length, aText: lineTops(a)[0], bText: lineTops(b)[0],
          colourA: getComputedStyle(a).color, colourB: getComputedStyle(b).color, muted: resolved('--muted'), ink: resolved('--ink'),
          blockB: getComputedStyle(b).display,
        };
      }, BOX));
      assert.equal(m.aLines, 1, `${lang}: the first part is one line`);
      assert.equal(m.bLines, 1, `${lang}: the second part is one line`);
      assert.ok(m.b.top - m.a.top >= m.lineHeight - 1, `${lang}: the second part starts one line below the first (${m.a.top} then ${m.b.top}, line ${m.lineHeight})`);
      assert.equal(m.blockB, 'block', `${lang}: the second part is a block`);
      assert.ok(Math.abs(m.bText - m.aText - m.lineHeight) <= 2, `${lang}: the text of the second part sits one line below the first (${m.aText} then ${m.bText}, line ${m.lineHeight})`);
      assert.equal(m.colourA, m.muted, `${lang}: the first part computes the --muted colour`);
      assert.equal(m.colourB, m.ink, `${lang}: the second part computes the --ink colour`);
      assert.notEqual(m.muted, m.ink, `${lang}: the two tones differ`);
    }
  });

  it('first screen columns at 1440 pixels and stacked at 390 pixels', async () => {
    for (const lang of ['en', 'tr']) {
      const wide = await withPage({ lang, need: ['h1', '.home-hero .grid', '.home-side', '.home-lead', '#cmd', '.pipeline'] }, (page) => page.evaluate((boxSource) => {
        const box = eval(boxSource);
        const grid = document.querySelector('.home-hero .grid');
        const style = getComputedStyle(grid);
        // The twelve tracks of the grid as the browser resolved them: left edge and width of each, in page coordinates.
        const widths = style.gridTemplateColumns.split(' ').map(parseFloat);
        const gap = parseFloat(style.columnGap) || 0; // 'normal' (no gap) is not a number
        const paddingLeft = parseFloat(style.paddingLeft);
        const tracks = [];
        let left = box(grid).left + paddingLeft;
        for (const width of widths) {
          tracks.push({ left, width });
          left += width + gap;
        }
        const columns = (selector) => {
          const s = getComputedStyle(document.querySelector(selector));
          return { start: s.gridColumnStart, end: s.gridColumnEnd };
        };
        return {
          grid: box(grid), tracks,
          h1: box(document.querySelector('h1')), side: box(document.querySelector('.home-side')), lead: box(document.querySelector('.home-lead')), cmd: box(document.querySelector('#cmd')), diagram: box(document.querySelector('.pipeline')),
          h1Columns: columns('h1'), sideColumns: columns('.home-side'),
        };
      }, BOX));
      assert.equal(wide.tracks.length, 12, `${lang} 1440: the first row is a twelve column grid`);
      const span = (from, to) => wide.tracks[to - 1].left + wide.tracks[to - 1].width - wide.tracks[from - 1].left;
      // First column of a box: the track whose left edge it starts on; last column: the track whose right edge it ends on (a box that starts or ends between tracks gives -1).
      const startsOn = (b) => wide.tracks.findIndex((t) => Math.abs(t.left - b.left) <= 1) + 1 || -1;
      const endsOn = (b) => wide.tracks.findIndex((t) => Math.abs(t.left + t.width - b.right) <= 1) + 1 || -1;
      assert.ok(span(8, 12) >= 560 - 1, `${lang} 1440: five columns are at least the 560 px maximum, so a four column box (${span(8, 11)}) is told apart`);
      assert.deepEqual([startsOn(wide.h1), endsOn(wide.h1)], [1, 7], `${lang} 1440: the headline spans columns 1 to 7`);
      assert.deepEqual([wide.h1Columns.start, wide.h1Columns.end], ['1', 'span 7'], `${lang} 1440: the headline asks for seven columns from the first`);
      assert.equal(startsOn(wide.side), 8, `${lang} 1440: the description and the command column starts on column 8`);
      assert.deepEqual([wide.sideColumns.start, wide.sideColumns.end], ['8', 'span 5'], `${lang} 1440: the right column asks for five columns from the eighth`);
      assert.ok(Math.abs(wide.h1.width - span(1, 7)) <= 1, `${lang} 1440: the headline is seven columns wide (${wide.h1.width})`);
      // The right column is five columns wide, held to its 560 px maximum (five columns are 566.6 px at 1440 px); four columns would be 453 px.
      assert.ok(Math.abs(wide.side.width - Math.min(560, span(8, 12))) <= 1, `${lang} 1440: the right column is five columns wide (${wide.side.width})`);
      assert.ok(wide.side.right <= wide.tracks[11].left + wide.tracks[11].width + 1, `${lang} 1440: the right column ends in column 12`);
      assert.ok(wide.lead.left >= wide.tracks[7].left - 1 && wide.lead.right <= wide.tracks[11].left + wide.tracks[11].width + 1, `${lang} 1440: the description lies in columns 8 to 12`);
      assert.ok(wide.cmd.left >= wide.tracks[7].left - 1 && wide.cmd.right <= wide.tracks[11].left + wide.tracks[11].width + 1, `${lang} 1440: the command lies in columns 8 to 12`);
      assert.ok(wide.lead.top < wide.cmd.top, `${lang} 1440: the description comes before the command`);
      assert.ok(wide.diagram.top >= Math.max(wide.h1.bottom, wide.side.bottom) - 1, `${lang} 1440: the diagram frame comes after the first row`);

      const narrow = await withPage({ lang, width: 390, need: ['h1', '.home-lead', '#cmd', '.pipeline', '.pipeline-key', '.pipeline-legend'] }, (page) => page.evaluate((boxSource) => {
        const box = eval(boxSource);
        const top = (selector) => box(document.querySelector(selector)).top;
        return {
          order: ['h1', '.home-lead', '#cmd', '.pipeline', '.pipeline-key', '.pipeline-legend'].map(top),
          scroll: document.documentElement.scrollWidth,
          h1: box(document.querySelector('h1')), cmd: box(document.querySelector('#cmd')),
          grid: box(document.querySelector('.home-hero .grid')), side: box(document.querySelector('.home-side')), lead: box(document.querySelector('.home-lead')),
          h1Columns: [getComputedStyle(document.querySelector('h1')).gridColumnStart, getComputedStyle(document.querySelector('h1')).gridColumnEnd],
          sideColumns: [getComputedStyle(document.querySelector('.home-side')).gridColumnStart, getComputedStyle(document.querySelector('.home-side')).gridColumnEnd],
        };
      }, BOX));
      assert.deepEqual([...narrow.order].sort((x, y) => x - y), narrow.order, `${lang} 390: headline, description, command, diagram, key line, legend run top to bottom`);
      assert.ok(narrow.order.every((y, i) => i === 0 || y > narrow.order[i - 1]), `${lang} 390: each part starts below the one before`);
      assert.ok(narrow.scroll <= 390, `${lang} 390: no horizontal scroll (${narrow.scroll})`);
      assert.ok(narrow.h1.width > 390 * 0.8 && narrow.cmd.width > 390 * 0.8, `${lang} 390: the headline and the command take the full width`);
      // One column: the headline and the right column both span the whole grid and the headline ends above the right column.
      for (const [name, b] of [['headline', narrow.h1], ['right column', narrow.side]]) {
        assert.ok(Math.abs(b.left - narrow.grid.left) <= 1 && Math.abs(b.right - narrow.grid.right) <= 1, `${lang} 390: the ${name} spans the whole grid (${b.left} to ${b.right}, grid ${narrow.grid.left} to ${narrow.grid.right})`);
      }
      assert.deepEqual([narrow.h1Columns, narrow.sideColumns], [['1', '-1'], ['1', '-1']], `${lang} 390: both ask for every column`);
      assert.ok(narrow.h1.bottom <= narrow.side.top + 1, `${lang} 390: the headline ends above the right column (${narrow.h1.bottom} then ${narrow.side.top})`);
      assert.ok(narrow.lead.left >= narrow.grid.left - 1 && narrow.cmd.left >= narrow.grid.left - 1 && narrow.lead.top < narrow.cmd.top, `${lang} 390: the description comes above the command inside the grid`);
    }
  });

  it('lower section is one six column reading column with a hatched tab', async () => {
    for (const lang of ['en', 'tr']) {
      const m = await withPage({ lang, need: ['.home-run .grid', '.home-col', '.home-col h2', '.home-tab'] }, (page) => page.evaluate((boxSource) => {
        const box = eval(boxSource);
        const hatch = (() => {
          const probe = document.createElement('span');
          probe.style.color = 'var(--hatch)';
          document.body.append(probe);
          const c = getComputedStyle(probe).color;
          probe.remove();
          return c;
        })();
        const hatched = [...document.querySelectorAll('main svg path, main svg line')].filter((el) => getComputedStyle(el).stroke === hatch);
        const tab = document.querySelector('.home-tab');
        return {
          grid: box(document.querySelector('.home-run .grid')), col: box(document.querySelector('.home-col')), tab: box(tab), h2: box(document.querySelector('.home-col h2')),
          hatched: hatched.map((el) => ({ rail: !!el.closest('.pipeline-rail-svg'), tab: !!el.closest('.home-tab') })),
          tabBorder: getComputedStyle(tab).borderTopWidth,
          images: [...document.querySelectorAll('main *')].filter((el) => getComputedStyle(el).backgroundImage !== 'none').map((el) => el.className.toString() || el.tagName),
          tabs: document.querySelectorAll('.home-tab').length,
          h1Box: box(document.querySelector('h1')),
        };
      }, BOX));
      const column = m.grid.width / 12;
      assert.ok(Math.abs(m.col.left - (m.grid.left + 3 * column)) <= 1, `${lang}: the lower column starts at column 4 (${m.col.left} against ${m.grid.left + 3 * column})`);
      assert.ok(Math.abs(m.col.width - 6 * column) <= 1, `${lang}: the lower column is six columns wide (${m.col.width} against ${6 * column})`);
      assert.equal(m.tabs, 1, `${lang}: one hatched tab`);
      assert.ok(Math.abs(m.tab.width - 14) <= 0.5 && Math.abs(m.tab.height - 92) <= 0.5, `${lang}: the tab is 14 by 92 (${m.tab.width} by ${m.tab.height})`);
      assert.ok(m.tab.right <= m.col.left, `${lang}: the tab lies beside the column, in the margin`);
      assert.ok(m.tab.top < m.h2.bottom && m.tab.bottom > m.h2.top, `${lang}: the tab sits beside the section headline`);
      assert.ok(m.hatched.length >= 2, `${lang}: the rails and the tab are hatched (${m.hatched.length} strokes)`);
      assert.ok(m.hatched.every((h) => h.rail || h.tab), `${lang}: no hatched stroke lies outside the rails of the diagram and the tab`);
      assert.equal(m.hatched.filter((h) => h.tab).length, 1, `${lang}: the tab is one hatched path`);
      assert.deepEqual(m.images, [], `${lang}: no element of main has a background image`);
    }
  });

  it('pages read with the controls script blocked', async () => {
    for (const lang of ['en', 'tr']) {
      const m = await withPage({ lang, blockControls: true, need: ['h1', '.home-lead', '#cmd', '.pipeline', '.home-col h2', '.home-reply', '.home-limits', '#b-copy', '#b-theme', '#b-lang'] }, async (page) => {
        const state = await page.evaluate((boxSource) => {
          const box = eval(boxSource);
          const visible = (el) => { const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && el.getBoundingClientRect().width > 0; };
          const cmd = document.querySelector('#cmd');
          const range = document.createRange();
          range.selectNodeContents(cmd);
          const selection = getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          return {
            jsClass: document.documentElement.classList.contains('js'),
            shown: ['h1', '.home-lead', '#cmd', '.pipeline', '.home-col h2', '.home-reply', '.home-limits'].map((s) => [s, visible(document.querySelector(s))]),
            copy: visible(document.querySelector('#b-copy')),
            theme: visible(document.querySelector('#b-theme')),
            language: visible(document.querySelector('#b-lang')),
            userSelect: getComputedStyle(cmd).userSelect,
            selected: selection.toString(),
            box: box(cmd),
          };
        }, BOX);
        return state;
      });
      assert.equal(m.jsClass, false, `${lang}: the html element has no js class`);
      assert.deepEqual(m.shown.filter(([, ok]) => !ok), [], `${lang}: everything reads`);
      assert.equal(m.copy, false, `${lang}: the copy button is not visible`);
      assert.equal(m.theme, false, `${lang}: the theme button is not visible`);
      assert.equal(m.language, true, `${lang}: the language link is visible`);
      assert.notEqual(m.userSelect, 'none', `${lang}: the command can be selected`);
      assert.equal(m.selected.replace(/\r/g, '').trim(), INSTALL_TEXT, `${lang}: the selection is the two install lines`);
    }
    // The language link navigates without the script, from one home page to the other and back.
    await withPage({ lang: 'en', blockControls: true }, async (page) => {
      await page.click('#b-lang');
      await page.waitForURL('**/tr/');
      assert.equal(await page.evaluate(() => document.documentElement.lang), 'tr', 'the link leads to the Turkish home page');
      await page.click('#b-lang');
      await page.waitForURL((url) => url.pathname === '/');
      assert.equal(await page.evaluate(() => document.documentElement.lang), 'en', 'the link leads back to the English home page');
    });
    // The theme follows the system by CSS alone.
    for (const [scheme, bg] of [['dark', DARK_BG], ['light', LIGHT_BG]]) {
      const value = await withPage({ scheme, blockControls: true }, (page) => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()));
      assert.equal(value, bg, `${scheme} system setting: --bg`);
    }
  });

  it('type steps and browser edges at 1440, 768 and 390 pixels', async () => {
    // The body size as the visual proof measures it: the median font size of the visible paragraphs and list items of main with at least 40 characters of own text.
    const measure = (page) => page.evaluate(() => {
      const ownText = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
      const visible = (el) => { const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && el.getBoundingClientRect().width > 0; };
      const sizes = [...document.querySelectorAll('main p, main li')].filter((el) => visible(el) && ownText(el).length >= 40).map((el) => parseFloat(getComputedStyle(el).fontSize)).sort((x, y) => x - y);
      const middle = Math.floor(sizes.length / 2);
      const median = sizes.length === 0 ? 0 : sizes.length % 2 === 1 ? sizes[middle] : (sizes[middle - 1] + sizes[middle]) / 2;
      const h1 = document.querySelector('h1');
      // Lines of the headline: the distinct tops of the rectangles of its text, which are the same whatever the inline boxes around the text.
      const tops = new Set();
      const walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        if (node.textContent.trim() === '') continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const r of range.getClientRects()) if (r.width > 0) tops.add(Math.round(r.top));
      }
      const lines = tops.size;
      return { counted: sizes.length, median, head: parseFloat(getComputedStyle(h1).fontSize), lines };
    });
    for (const lang of ['en', 'tr']) {
      for (const width of [1440, 768, 390]) {
        const m = await withPage({ lang, width, need: ['h1', 'main p'] }, measure);
        assert.ok(m.counted > 0, `${lang} ${width}: some paragraph counts as body text`);
        if (width === 1440 || width === 768) assert.ok(m.head >= 3 * m.median, `${lang} ${width}: the headline (${m.head}) is at least 3 times the body (${m.median})`);
        if (width === 390) {
          assert.ok(m.median >= 16, `${lang} 390: the body text is at least 16 px (${m.median})`);
          // The two line headline rule wins over the 3 to 1 ratio on a phone (design decision of amendment 002).
          assert.equal(m.lines, 2, `${lang} 390: the headline breaks in two lines (${m.lines})`);
        }
      }
    }
    // The selection and the scrollbar follow the theme: both are tokens, resolved here through a probe and compared with what the browser computes.
    for (const scheme of ['light', 'dark']) {
      for (const lang of ['en', 'tr']) {
        const m = await withPage({ lang, scheme, need: ['h1'] }, (page) => page.evaluate(() => {
          const resolved = (token) => {
            const probe = document.createElement('span');
            probe.style.color = `var(${token})`;
            document.body.append(probe);
            const colour = getComputedStyle(probe).color;
            probe.remove();
            return colour;
          };
          const selected = getComputedStyle(document.querySelector('h1'), '::selection');
          return { ground: selected.backgroundColor, text: selected.color, scrollbar: getComputedStyle(document.documentElement).scrollbarColor, ink: resolved('--ink'), bg: resolved('--bg'), muted: resolved('--muted') };
        }));
        assert.equal(m.ground, m.ink, `${lang} ${scheme}: selected text has the --ink ground`);
        assert.equal(m.text, m.bg, `${lang} ${scheme}: selected text has the --bg colour`);
        assert.equal(m.scrollbar, `${m.muted} ${m.bg}`, `${lang} ${scheme}: the scrollbar thumb is --muted on a --bg track`);
        assert.notEqual(m.ink, m.bg, `${lang} ${scheme}: ink and ground differ`);
      }
    }
  });

  it('selected text stays readable in the page and in the drawing on both pages and in both themes', async () => {
    // Contrast ratio of two computed colours (WCAG relative luminance); both come from the browser as rgb() strings.
    const luminance = (colour) => {
      const [r, g, b] = colour.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
    for (const scheme of ['light', 'dark']) {
      for (const lang of ['en', 'tr']) {
        const label = `${lang} ${scheme}`;
        // One context per case: select the node, read what the browser computes for the selection, and photograph the selected region.
        const context = await browser.newContext({ viewport: { width: 1440, height: HEIGHT }, colorScheme: scheme, reducedMotion: 'reduce' });
        try {
          const page = await context.newPage();
          await page.goto(`${site.url}${ADDRESS[lang]}`);
          await page.evaluate(() => document.fonts.ready);
          const measured = await page.evaluate(() => {
            const resolved = (token) => {
              const probe = document.createElement('span');
              probe.style.color = `var(${token})`;
              document.body.append(probe);
              const colour = getComputedStyle(probe).color;
              probe.remove();
              return colour;
            };
            const select = (el) => {
              el.scrollIntoView({ block: 'center' });
              const range = document.createRange();
              range.selectNodeContents(el);
              const selection = getSelection();
              selection.removeAllRanges();
              selection.addRange(range);
              const r = el.getBoundingClientRect();
              const s = getComputedStyle(el, '::selection');
              return { found: true, clip: { x: Math.floor(r.left), y: Math.floor(r.top), width: Math.ceil(r.width), height: Math.ceil(r.height) }, fill: s.fill, color: s.color, ground: s.backgroundColor };
            };
            const none = { found: false };
            // The drawing label is selected last, so the selection that is photographed afterwards is the label.
            const svgLabels = [...document.querySelectorAll('.pipeline text')];
            const review = svgLabels.find((t) => t.textContent.includes('REVIEW'));
            const h1 = document.querySelector('h1');
            return { ink: resolved('--ink'), bg: resolved('--bg'), labels: svgLabels.length, fills: svgLabels.map((t) => getComputedStyle(t, '::selection').fill), html: h1 ? select(h1) : none, svg: review ? select(review) : none };
          });
          assert.ok(measured.labels > 0, `${label}: the drawing holds text labels`);
          assert.deepEqual([...new Set(measured.fills)], [measured.bg], `${label}: every one of the ${measured.labels} drawing labels is filled with --bg when selected`);
          assert.ok(measured.svg.found && measured.html.found, `${label}: the REVIEW label and the headline exist`);
          // Page text: the base rule, ink ground and bg text.
          assert.equal(measured.html.ground, measured.ink, `${label}: selected page text has the --ink ground`);
          assert.equal(measured.html.color, measured.bg, `${label}: selected page text has the --bg colour`);
          assert.ok(contrast(measured.html.color, measured.html.ground) >= 4.5, `${label}: selected page text reads (${measured.html.color} on ${measured.html.ground})`);
          // Drawing text: the browser paints SVG text with fill, so the selection needs its own fill; the ground stays the --ink ground of the base rule.
          assert.equal(measured.svg.ground, measured.ink, `${label}: a selected drawing label has the --ink ground`);
          assert.equal(measured.svg.fill, measured.bg, `${label}: a selected drawing label is filled with --bg`);
          assert.ok(contrast(measured.svg.fill, measured.svg.ground) >= 4.5, `${label}: a selected drawing label reads (${measured.svg.fill} on ${measured.svg.ground})`);
          // Pixels of the selected drawing label: glyph edges give many distinct values; ink on ink gives a flat region of one or two.
          // The selection stays on the live page while it is photographed; the photo is decoded on a blank page of the same context.
          const photo = await page.screenshot({ clip: measured.svg.clip });
          const reader = await context.newPage();
          const distinct = await reader.evaluate(async (base64) => {
            const image = new Image();
            image.src = `data:image/png;base64,${base64}`;
            await image.decode();
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            const seen = new Set();
            for (let i = 0; i < data.length; i += 4) seen.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
            return seen.size;
          }, photo.toString('base64'));
          assert.ok(distinct > 20, `${label}: the selected REVIEW label shows glyphs, not a flat block (${distinct} distinct pixel values)`);
        } finally {
          await context.close();
        }
      }
    }
  });
});
