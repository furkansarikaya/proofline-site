// Browser checks of the pipeline diagram component (TASK-018): run only by `npm run test:browser`, never by `node --test` discovery (ADR 0009).
// tests/fixtures/pipeline/render.mjs renders the component to static pages; Chromium of the Playwright library measures them. No sleep: animation state is read from computed styles.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startServer } from '../../scripts/serve-dist.mjs';
import { renderPipeline } from '../fixtures/pipeline/render.mjs';
import { removeTempDirs, sweepStale } from '../temp-dirs.mjs';

sweepStale();

// The strings of TASK-018 (Context), used verbatim.
const KEY = {
  en: 'Cross: blocked at review and sent back for a fix round. Check mark: CODE_DONE.',
  tr: 'Çarpı: review’da engellendi, fix round’a geri döner. Onay işareti: CODE_DONE.',
};
const LEGEND = {
  en: ['frozen with a scope: file list', 'RED, then GREEN, reproduced by the gates', 'never by whoever wrote the change', 'cannot be waived', 'CODE_DONE only when every required gate passed'],
  tr: ['scope: dosya listesiyle dondurulur', 'önce RED, sonra GREEN; kapılar bağımsız yeniden üretir', 'değişikliği yazan onu asla review etmez', 'waive edilemez', 'gerekli her kapı geçmeden CODE_DONE olmaz'],
};
const GATE_NAMES = ['01 PLAN', '02 TEST', '03 REVIEW', '04 SECURITY', '05 VERIFY'];
const READ_ORDER = ['TASK', ...GATE_NAMES, 'CODE_DONE'];
const HEIGHT = 900;

let fixture;
let site;
let browser;

before(async () => {
  fixture = await renderPipeline();
  site = await startServer({ root: fixture.dir });
  browser = await chromium.launch();
}, { timeout: 120000 });

after(async () => {
  try {
    await browser?.close();
    await site?.close();
  } finally {
    removeTempDirs();
  }
});

/** Open the fixture page in a fresh context, run `fn(page)` and always close the context. */
async function withPage({ lang = 'en', width = 1440, motion = 'no-preference', scheme = 'light', media = 'screen' }, fn) {
  const context = await browser.newContext({ viewport: { width, height: HEIGHT }, reducedMotion: motion, colorScheme: scheme });
  try {
    const page = await context.newPage();
    await page.emulateMedia({ media });
    await page.goto(`${site.url}${fixture.pages[lang].path}`);
    await page.evaluate(() => document.fonts.ready);
    const frames = await page.evaluate(() => document.querySelectorAll('section.pipeline svg.pipeline-drawing[role="img"]').length);
    assert.equal(frames, 1, `${lang} ${width}: the page shows one diagram frame with its drawing`);
    return await fn(page);
  } finally {
    await context.close();
  }
}

/** The still frame: the seven read-in-order texts, the five gates, both slabs and their shapes, as measured boxes and computed styles. */
function measureStill() {
  const squash = (t) => t.replace(/\s+/g, ' ').trim();
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height, cx: r.left + r.width / 2 };
  };
  const svg = document.querySelector('svg.pipeline-drawing');
  const texts = [...svg.querySelectorAll('text:not(.pipeline-blocked-label)')].map((el) => ({ text: squash(el.textContent), ...rect(el) }));
  const gates = [...svg.querySelectorAll('.pipeline-gate')].map(rect);
  const blocked = svg.querySelector('.pipeline-slab-blocked');
  const finished = svg.querySelector('.pipeline-slab-finished');
  const opacity = (el) => Number(getComputedStyle(el).opacity);
  return {
    texts,
    gates,
    blocked: {
      group: rect(blocked),
      body: rect(blocked.querySelector('.pipeline-slab-body')),
      label: squash(blocked.querySelector('text')?.textContent ?? ''),
      crossBoxes: [...blocked.querySelectorAll('.pipeline-cross')].map(rect),
      crossOpacity: opacity(blocked.querySelector('.pipeline-state-blocked')),
      passOpacity: opacity(blocked.querySelector('.pipeline-state-finished')),
    },
    finished: {
      group: rect(finished),
      body: rect(finished.querySelector('.pipeline-slab-body')),
      checkBoxes: [...finished.querySelectorAll('.pipeline-check')].map(rect),
      checkOpacity: opacity(finished.querySelector('.pipeline-state-finished')),
    },
  };
}

/** Assert the still frame of AC-3 on a measurement. */
function assertStillFrame(m, where) {
  const review = m.gates[2];
  const verify = m.gates[4];
  assert.equal(m.blocked.label, 'BLOCKED', `${where}: the blocked slab carries the label BLOCKED`);
  assert.equal(m.blocked.crossBoxes.length, 2, `${where}: the blocked slab carries a cross of two strokes`);
  for (const b of m.blocked.crossBoxes) assert.ok(b.width > 0 && b.height > 0, `${where}: a cross stroke has a box`);
  assert.equal(m.blocked.crossOpacity, 1, `${where}: the cross is shown`);
  assert.equal(m.blocked.passOpacity, 0, `${where}: the blocked slab does not show a check mark`);
  assert.ok(m.blocked.body.cx >= review.left && m.blocked.body.cx <= review.right, `${where}: the blocked slab centre ${m.blocked.body.cx} lies within the 03 REVIEW arch ${review.left}..${review.right}`);
  assert.ok(m.blocked.group.cx >= review.left && m.blocked.group.cx <= review.right, `${where}: the blocked slab with its label is centred within the 03 REVIEW arch`);
  assert.equal(m.finished.checkBoxes.length, 1, `${where}: the finished slab carries a check mark`);
  assert.ok(m.finished.checkBoxes[0].width > 0 && m.finished.checkBoxes[0].height > 0, `${where}: the check mark has a box`);
  assert.equal(m.finished.checkOpacity, 1, `${where}: the check mark is shown`);
  assert.ok(m.finished.body.left >= verify.right, `${where}: the finished slab ${m.finished.body.left} lies right of the 05 VERIFY arch ${verify.right}`);
}

describe('pipeline diagram in Chromium', { timeout: 60000 }, () => {
  it('the drawing texts run left to right with each gate label above its arch', async () => {
    for (const lang of ['en', 'tr']) {
      const m = await withPage({ lang, motion: 'reduce' }, (page) => page.evaluate(measureStill));
      assert.deepEqual([...m.texts].sort((a, b) => a.left - b.left).map((t) => t.text), READ_ORDER, `${lang}: sorted by left edge`);
      assert.deepEqual([...m.texts].sort((a, b) => a.cx - b.cx).map((t) => t.text), READ_ORDER, `${lang}: sorted by centre`);
      assert.equal(m.gates.length, 5, `${lang}: five gate arches`);
      GATE_NAMES.forEach((name, k) => {
        const label = m.texts.find((t) => t.text === name);
        const gate = m.gates[k];
        assert.ok(label.bottom < gate.top, `${lang}: ${name} label bottom ${label.bottom} is above its arch top ${gate.top}`);
        assert.ok(label.cx >= gate.left && label.cx <= gate.right, `${lang}: ${name} label centre ${label.cx} lies within its arch ${gate.left}..${gate.right}`);
      });
    }
  });

  it('the still frame puts the blocked slab at the review arch and the finished slab at the exit', async () => {
    for (const lang of ['en', 'tr']) {
      const m = await withPage({ lang, motion: 'reduce' }, (page) => page.evaluate(measureStill));
      assertStillFrame(m, lang);
    }
  });

  it('motion allowed gives both slabs a 20 s infinite animation', async () => {
    const m = await withPage({ motion: 'no-preference' }, (page) => page.evaluate(() => {
      const animated = (slab) => [slab, ...slab.querySelectorAll('*')].map((el) => {
        const s = getComputedStyle(el);
        return { cls: el.getAttribute('class'), name: s.animationName, duration: s.animationDuration, count: s.animationIterationCount };
      }).filter((a) => a.name !== 'none');
      return {
        a: animated(document.querySelector('.pipeline-slab-finished')),
        b: animated(document.querySelector('.pipeline-slab-blocked')),
        counts: ['script', 'animate', 'animateTransform', 'set'].map((t) => document.querySelectorAll(`section.pipeline ${t}`).length),
        onAttrs: [...document.querySelectorAll('section.pipeline *')].filter((el) => [...el.attributes].some((at) => /^on/i.test(at.name))).length,
      };
    }));
    for (const [slab, list] of [['A (finished)', m.a], ['B (blocked)', m.b]]) {
      assert.ok(list.length > 0, `slab ${slab} has an animated element`);
      for (const a of list) {
        assert.equal(a.duration, '20s', `slab ${slab} ${a.cls}: duration`);
        assert.equal(a.count, 'infinite', `slab ${slab} ${a.cls}: iteration count`);
      }
    }
    assert.deepEqual(m.counts, [0, 0, 0, 0], 'no script and no SMIL element in the page');
    assert.equal(m.onAttrs, 0, 'no on attribute');
  });

  it('reduced motion removes every animation and keeps the still frame', async () => {
    const m = await withPage({ motion: 'reduce' }, (page) => page.evaluate(() => ({
      names: [...document.querySelectorAll('section.pipeline, section.pipeline *')].map((el) => [el.tagName, getComputedStyle(el).animationName]).filter(([, n]) => n !== 'none'),
      running: document.getAnimations().length,
    })));
    assert.deepEqual(m.names, [], 'every element computes animation-name none');
    assert.equal(m.running, 0, 'the document runs no animation');
    assertStillFrame(await withPage({ motion: 'reduce' }, (page) => page.evaluate(measureStill)), 'reduced motion');
  });

  it('print media shows the still frame even when motion is allowed', async () => {
    for (const lang of ['en', 'tr']) {
      const printed = await withPage({ lang, motion: 'no-preference', media: 'print' }, async (page) => ({
        matches: await page.evaluate(() => [matchMedia('print').matches, matchMedia('(prefers-reduced-motion: no-preference)').matches]),
        names: await page.evaluate(() => [...document.querySelectorAll('section.pipeline, section.pipeline *')].map((el) => [el.tagName, getComputedStyle(el).animationName]).filter(([, n]) => n !== 'none')),
        running: await page.evaluate(() => document.getAnimations().length),
        still: await page.evaluate(measureStill),
      }));
      assert.deepEqual(printed.matches, [true, true], `${lang}: the page is in print media with motion allowed`);
      assert.deepEqual(printed.names, [], `${lang}: under print no element computes an animation name`);
      assert.equal(printed.running, 0, `${lang}: under print the document runs no animation`);
      assertStillFrame(printed.still, `${lang} print`);
    }
  });

  it('label heights meet the design measurements at six widths', async () => {
    const floors = { 460: 12.7, 500: 14.0, 600: 17.3 };
    for (const width of [460, 500, 600, 721, 1000, 1440]) {
      const sizes = await withPage({ width, motion: 'reduce' }, (page) => page.evaluate(() => {
        const svg = document.querySelector('svg.pipeline-drawing');
        const scale = svg.getBoundingClientRect().width / 850;
        return [...svg.querySelectorAll('text')].map((t) => ({
          text: t.textContent.replace(/\s+/g, ' ').trim(),
          shown: t.getBoundingClientRect().width > 0,
          size: parseFloat(getComputedStyle(t).fontSize) * scale,
          box: t.getBoundingClientRect().height,
        }));
      }));
      assert.equal(sizes.length, 8, `${width}: seven labels and BLOCKED`);
      for (const s of sizes) {
        assert.ok(s.shown, `${width}: ${s.text} is displayed`);
        assert.ok(s.size >= 12, `${width}: ${s.text} is ${s.size.toFixed(2)}px, at least 12`);
        assert.ok(s.box >= s.size - 0.1, `${width}: the box of ${s.text} is at least its size`);
        if (floors[width]) assert.ok(s.size >= floors[width] - 0.1, `${width}: ${s.text} is ${s.size.toFixed(2)}px, at least ${floors[width]}`);
      }
    }
  });

  it('below 460 px the labels hide and the key line shows with the shapes kept', async () => {
    for (const lang of ['en', 'tr']) {
      for (const width of [459, 460]) {
        const m = await withPage({ lang, width, motion: 'reduce' }, (page) => page.evaluate(() => {
          const key = document.querySelector('.pipeline-key');
          const ks = getComputedStyle(key);
          const r = (el) => el.getBoundingClientRect();
          return {
            labels: [...document.querySelectorAll('svg.pipeline-drawing text')].map((t) => ({ shown: r(t).width > 0, w: r(t).width })),
            keyDisplay: ks.display,
            keySize: parseFloat(ks.fontSize),
            keyText: key.textContent.trim(),
            keyBox: r(key).height,
            shapes: [...document.querySelectorAll('.pipeline-cross, .pipeline-check')].map((s) => ({ w: r(s).width, h: r(s).height })),
          };
        }));
        assert.ok(m.shapes.length >= 3 && m.shapes.every((s) => s.w > 0 && s.h > 0), `${lang} ${width}: the cross and check shapes are still drawn`);
        if (width === 459) {
          assert.ok(m.labels.length > 0 && m.labels.every((l) => !l.shown && l.w === 0), `${lang} 459: no label is visible`);
          assert.notEqual(m.keyDisplay, 'none', `${lang} 459: the key line is displayed`);
          assert.ok(m.keySize >= 14, `${lang} 459: the key line is ${m.keySize}px`);
          assert.ok(m.keyBox > 0, `${lang} 459: the key line takes space`);
          assert.equal(m.keyText, KEY[lang], `${lang} 459: the key line text`);
        } else {
          assert.ok(m.labels.every((l) => l.shown && l.w > 0), `${lang} 460: the labels are visible`);
          assert.equal(m.keyDisplay, 'none', `${lang} 460: the key line is not displayed`);
        }
      }
    }
  });

  it('the legend is an ordered list of five items, a row at 1440 px and a column at 720 px', async () => {
    for (const lang of ['en', 'tr']) {
      for (const width of [1440, 721, 720, 460, 319]) {
        const m = await withPage({ lang, width, motion: 'reduce' }, (page) => page.evaluate(() => {
          const ol = document.querySelector('ol.pipeline-legend');
          const items = [...ol.querySelectorAll(':scope > li')];
          return {
            tag: ol.tagName,
            names: items.map((li) => li.querySelector('.pipeline-legend-name').textContent.replace(/\s+/g, ' ').trim()),
            texts: items.map((li) => li.querySelector('.pipeline-legend-text').textContent.trim()),
            boxes: items.map((li) => { const r = li.getBoundingClientRect(); return { top: r.top, left: r.left, width: r.width, height: r.height }; }),
            visible: items.map((li) => getComputedStyle(li).display !== 'none' && li.getBoundingClientRect().height > 0),
            scroll: document.documentElement.scrollWidth,
          };
        }));
        const where = `${lang} ${width}`;
        assert.equal(m.tag, 'OL', `${where}: an ordered list`);
        assert.deepEqual(m.names, GATE_NAMES, `${where}: item names`);
        assert.deepEqual(m.texts, LEGEND[lang], `${where}: item sentences`);
        assert.ok(m.visible.every(Boolean), `${where}: every item is visible`);
        assert.ok(m.scroll <= width, `${where}: no horizontal scroll (${m.scroll})`);
        if (width >= 721) {
          assert.ok(m.boxes.every((b) => b.top === m.boxes[0].top), `${where}: one row`);
          assert.ok(m.boxes.every((b, i) => i === 0 || b.left > m.boxes[i - 1].left), `${where}: left to right`);
        } else {
          assert.ok(m.boxes.every((b, i) => i === 0 || b.top > m.boxes[i - 1].top), `${where}: one column, tops increase`);
          assert.ok(m.boxes.every((b) => b.left === m.boxes[0].left), `${where}: one column, one left edge`);
        }
      }
    }
  });

  it('the frame, the rails and the hatch follow the design at both rail widths', async () => {
    for (const scheme of ['light', 'dark']) {
      for (const width of [821, 820, 1440, 460]) {
        const m = await withPage({ width, scheme, motion: 'reduce' }, (page) => page.evaluate(() => {
          const colourOf = (value) => { const p = document.createElement('i'); p.style.color = value; document.body.append(p); const c = getComputedStyle(p).color; p.remove(); return c; };
          const frame = document.querySelector('section.pipeline');
          const fs = getComputedStyle(frame);
          const rails = [...frame.querySelectorAll('.pipeline-rail')];
          const hatches = [...frame.querySelectorAll('.pipeline-hatch')];
          const legend = frame.querySelector('ol.pipeline-legend');
          const fr = frame.getBoundingClientRect();
          const lr = legend.getBoundingClientRect();
          const all = [...frame.querySelectorAll('*')];
          return {
            border: ['Top', 'Right', 'Bottom', 'Left'].map((side) => [fs[`border${side}Width`], fs[`border${side}Style`], fs[`border${side}Color`]]),
            rule: colourOf('var(--rule)'),
            ground: fs.backgroundColor,
            frameToken: colourOf('var(--frame)'),
            hatchToken: colourOf('var(--hatch)'),
            railWidths: rails.map((r) => r.getBoundingClientRect().width),
            railHidden: rails.map((r) => r.getAttribute('aria-hidden')),
            railInner: rails.map((r, i) => (i === 0 ? getComputedStyle(r).borderRightWidth : getComputedStyle(r).borderLeftWidth)),
            hatchTags: hatches.map((h) => h.tagName.toLowerCase()),
            hatchStroke: hatches.map((h) => getComputedStyle(h).stroke),
            hatchFill: hatches.map((h) => getComputedStyle(h).fill),
            hatchInRails: hatches.every((h) => h.closest('.pipeline-rail')),
            hatchPerRail: rails.map((r) => r.querySelectorAll('.pipeline-hatch').length),
            hatchCover: rails.map((r) => {
              const box = r.querySelector('.pipeline-hatch').getBBox();
              const rr = r.getBoundingClientRect();
              return { top: box.y, bottom: box.y + box.height, left: box.x, right: box.x + box.width, width: rr.width, height: rr.height };
            }),
            patterns: frame.querySelectorAll('pattern').length,
            ids: all.filter((el) => el.hasAttribute('id')).length,
            urlFills: all.filter((el) => /url\(/.test(el.getAttribute('fill') ?? '') || /url\(/.test(getComputedStyle(el).fill ?? '') || /url\(/.test(getComputedStyle(el).stroke ?? '')).length,
            backgroundImages: all.map((el) => getComputedStyle(el).backgroundImage).filter((b) => b !== 'none').length,
            lastChild: frame.lastElementChild === legend,
            legendBottom: lr.bottom,
            frameInnerBottom: fr.bottom - parseFloat(fs.borderBottomWidth),
            legendTop: lr.top,
            padBottom: frame.querySelector('.pipeline-pad').getBoundingClientRect().bottom,
          };
        }));
        const where = `${scheme} ${width}`;
        for (const [w, style, colour] of m.border) {
          assert.equal(w, '1px', `${where}: border is 1px`);
          assert.equal(style, 'solid', `${where}: border is solid`);
          assert.equal(colour, m.rule, `${where}: border colour is --rule`);
        }
        assert.equal(m.ground, m.frameToken, `${where}: ground is --frame`);
        const rail = width > 820 ? 26 : 12;
        assert.deepEqual(m.railWidths, [rail, rail], `${where}: rails are ${rail}px`);
        assert.deepEqual(m.railHidden, ['true', 'true'], `${where}: rails are aria-hidden`);
        assert.deepEqual(m.railInner, ['1px', '1px'], `${where}: rails have a 1px inner edge`);
        assert.deepEqual(m.hatchTags, ['path', 'path'], `${where}: one hatch path per rail`);
        assert.deepEqual(m.hatchPerRail, [1, 1], `${where}: each rail holds one hatch path`);
        assert.ok(m.hatchStroke.every((s) => s === m.hatchToken), `${where}: hatch lines are stroked with --hatch (${m.hatchStroke} vs ${m.hatchToken})`);
        assert.ok(m.hatchFill.every((f) => f === 'none'), `${where}: the hatch path has no fill (${m.hatchFill})`);
        assert.ok(m.hatchInRails, `${where}: hatch lives in the rails only`);
        for (const c of m.hatchCover) {
          assert.ok(c.top <= 0 && c.bottom >= c.height, `${where}: the hatch covers the rail height ${c.height} (${c.top}..${c.bottom})`);
          assert.ok(c.left <= 0 && c.right >= c.width, `${where}: the hatch covers the rail width ${c.width} (${c.left}..${c.right})`);
        }
        assert.equal(m.patterns, 0, `${where}: no svg pattern, so no id repeats when the component is used twice`);
        assert.equal(m.ids, 0, `${where}: the frame holds no id`);
        assert.equal(m.urlFills, 0, `${where}: no hatched fill or url reference anywhere in the frame`);
        assert.equal(m.backgroundImages, 0, `${where}: no element has a background image or gradient`);
        assert.ok(m.lastChild, `${where}: the legend is the frame's last row`);
        assert.ok(m.legendTop >= m.padBottom - 0.5, `${where}: the legend sits below the drawing`);
        assert.ok(Math.abs(m.legendBottom - m.frameInnerBottom) < 0.5, `${where}: the legend ends at the frame's inner bottom`);
      }
    }
  });
});
