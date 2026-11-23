// Node tests for the pipeline diagram component (TASK-018): the rendered markup of both languages and src/styles/pipeline.css.
// The component has no page of its own, so tests/fixtures/pipeline/render.mjs renders it through the Astro container into a temp folder; the browser checks are tests/browser/pipeline.mjs.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'cheerio';
import { renderPipeline, root } from './fixtures/pipeline/render.mjs';
import { removeTempDirs, sweepStale } from './temp-dirs.mjs';

sweepStale();
after(removeTempDirs);

const NAMES = ['PLAN', 'TEST', 'REVIEW', 'SECURITY', 'VERIFY', 'BLOCKED', 'CODE_DONE'];
const LANGS = ['en', 'tr'];
const RED_VALUES = ['#c4152b', '#e0354a'];

const read = (rel) => (existsSync(join(root, rel)) ? readFileSync(join(root, rel), 'utf8') : '');
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '');
const squash = (text) => text.replace(/\s+/g, ' ').trim();

/** [{ selector, body }] of a stylesheet: every `selector { body }` pair, media and keyframe wrappers unrolled, comments dropped. */
function cssRules(text) {
  return [...stripComments(text).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: squash(m[1]), body: squash(m[2]) }));
}

/** A colour written as a literal: a hash colour (not a `url(#id)` reference) or an rgb, rgba, hsl, hsla function. */
function colourLiterals(text) {
  return text.replace(/url\(\s*#[^)]*\)/g, '').match(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\s*\(/g) ?? [];
}

let rendered;

before(async () => {
  rendered = await renderPipeline();
}, { timeout: 120000 });

describe('pipeline diagram markup and styles', () => {
  const doc = (lang) => load(rendered.pages[lang].component, null, false);

  it('the component renders one svg with a role and a label naming the seven names in both languages', () => {
    const labels = {};
    for (const lang of LANGS) {
      const $ = doc(lang);
      const svgs = $('svg[role="img"]');
      assert.equal(svgs.length, 1, `${lang}: exactly one svg with role img`);
      const label = svgs.attr('aria-label') ?? '';
      assert.ok(label.trim().length > 0, `${lang}: the aria-label is not empty`);
      for (const name of NAMES) assert.ok(label.includes(name), `${lang}: the aria-label names ${name}: "${label}"`);
      labels[lang] = label;
    }
    assert.notEqual(labels.tr, labels.en, 'the Turkish label differs from the English one');
  });

  it('the slab fills use the two tokens, var block has one use and the drawing holds no colour literal', () => {
    const css = read('src/styles/pipeline.css');
    const rules = cssRules(css);
    const blockRules = rules.filter((r) => /var\(\s*--block\s*\)/.test(r.body));
    assert.equal(blockRules.length, 1, `var(--block) is used by exactly one rule, found ${blockRules.length}`);
    assert.match(blockRules[0].body, /(?:^|;|\s)fill:\s*var\(--block\)/, 'the one rule sets the fill from var(--block)');
    assert.match(blockRules[0].selector, /pipeline-state-blocked/, 'the one rule is the blocked slab state');
    const accentRules = rules.filter((r) => /(?:^|;|\s)fill:\s*var\(--accent\)/.test(r.body));
    assert.ok(accentRules.some((r) => /pipeline-state-finished/.test(r.selector)), 'the finished slab state fills from var(--accent)');
    for (const lang of LANGS) {
      const $ = doc(lang);
      assert.equal($('.pipeline-slab-blocked .pipeline-state-blocked .pipeline-top').length, 1, `${lang}: the blocked slab has one blocked top face`);
      assert.equal($('.pipeline-slab-finished .pipeline-state-finished .pipeline-top').length, 1, `${lang}: the finished slab has one finished top face`);
      assert.deepEqual(colourLiterals(rendered.pages[lang].component), [], `${lang}: the rendered drawing holds no colour literal`);
    }
    assert.deepEqual(colourLiterals(stripComments(css)), [], 'pipeline.css holds no colour literal');
    assert.deepEqual(colourLiterals(stripComments(read('src/components/marketing/PipelineDiagram.astro').replace(/^---[\s\S]*?---/, ''))), [], 'the component template holds no colour literal');
    assert.deepEqual(colourLiterals('<polygon fill="#c4152b"/><rect style="color: rgb(0,0,0)"/>'), ['#c4152b', 'rgb('], 'the literal check does see a hash colour and rgb(');
  });

  it('the page css holds the red values only in the block token declaration', () => {
    const css = rendered.css;
    assert.ok(css.length > 0, 'the harness serves one stylesheet');
    const lower = css.toLowerCase();
    for (const value of RED_VALUES) {
      const at = [...lower.matchAll(new RegExp(value, 'g'))].map((m) => m.index);
      assert.ok(at.length > 0, `the page css holds ${value} in the token`);
      for (const i of at) assert.match(lower.slice(Math.max(0, i - 12), i), /--block:\s*$/, `${value} appears only right after "--block:"`);
    }
    assert.equal((css.match(/var\(\s*--block\b/g) ?? []).length, 1, 'var(--block) occurs once in the page css');
    const [rule] = cssRules(css).filter((r) => /var\(\s*--block\b/.test(r.body));
    assert.match(rule.selector, /pipeline-state-blocked/, 'the one use is in the blocked-slab rule of the diagram');
    assert.match(css, /pipeline-state-blocked/, 'the harness stylesheet includes pipeline.css');
  });

  it('the output holds no script, no on attribute and no SMIL element', () => {
    for (const lang of LANGS) {
      const $ = doc(lang);
      const all = $('*').toArray();
      assert.ok(all.length > 50, `${lang}: the drawing was rendered (${all.length} elements)`);
      assert.equal($('script').length, 0, `${lang}: no script element`);
      assert.equal($('animate, animateTransform, animateMotion, animateColor, set').length, 0, `${lang}: no SMIL element`);
      assert.equal($('style').length, 0, `${lang}: no style element`);
      for (const el of all) {
        for (const name of Object.keys(el.attribs)) {
          assert.ok(!/^on/i.test(name), `${lang}: <${el.name}> has no ${name} attribute`);
          assert.notEqual(name.toLowerCase(), 'style', `${lang}: <${el.name}> has no style attribute`);
          assert.doesNotMatch(el.attribs[name], /javascript:/i, `${lang}: <${el.name} ${name}> holds no javascript: address`);
        }
      }
    }
    assert.equal(load('<svg><animate attributeName="x"></animate><circle onclick="x()"></circle></svg>', null, false)('animate').length, 1, 'the SMIL check sees an animate element');
  });

  it('two copies of the component in one page hold no duplicate id and no svg pattern', () => {
    const $ = load(rendered.pair, null, false);
    assert.equal($('section.pipeline').length, 2, 'the page holds two copies of the frame');
    assert.equal($('svg.pipeline-drawing').length, 2, 'the page holds two drawings');
    const ids = $('[id]').toArray().map((el) => el.attribs.id);
    assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), [], `no id occurs twice (ids: ${ids.join(', ') || 'none'})`);
    assert.equal($('pattern').length, 0, 'no svg pattern is left, so no id has to be unique');
    assert.doesNotMatch(rendered.pair, /url\(\s*#/, 'no fill or stroke points at an id');
    const dup = load('<svg><pattern id="a"></pattern></svg><svg><pattern id="a"></pattern></svg>', null, false);
    const dupIds = dup('[id]').toArray().map((el) => el.attribs.id);
    assert.equal(new Set(dupIds).size < dupIds.length, true, 'the duplicate check does see two equal ids');
  });

  it('each slab state has a shape and a label and the blocked token is used for nothing else', () => {
    for (const lang of LANGS) {
      const $ = doc(lang);
      const blocked = $('.pipeline-slab-blocked');
      const finished = $('.pipeline-slab-finished');
      assert.equal(blocked.length, 1, `${lang}: one blocked slab`);
      assert.equal(finished.length, 1, `${lang}: one finished slab`);
      assert.equal(blocked.find('.pipeline-cross').length, 2, `${lang}: the blocked slab carries a cross of two strokes`);
      assert.equal(blocked.find('text').filter((_, t) => squash($(t).text()) === 'BLOCKED').length, 1, `${lang}: the blocked slab carries the label BLOCKED`);
      assert.equal(finished.find('.pipeline-check').length, 1, `${lang}: the finished slab carries a check mark`);
      assert.equal(finished.find('.pipeline-cross').length, 0, `${lang}: the finished slab has no cross`);
      assert.equal($('.pipeline-state-blocked').length, 1, `${lang}: only one element is in the blocked state`);
      assert.equal($('.pipeline-state-blocked').closest('.pipeline-slab-blocked').length, 1, `${lang}: the blocked state is inside the blocked slab`);
      const done = $('svg text').filter((_, t) => squash($(t).text()) === 'CODE_DONE');
      assert.equal(done.length, 1, `${lang}: the drawing labels the exit CODE_DONE`);
      assert.equal(done.closest('.pipeline-slab-blocked').length, 0, `${lang}: CODE_DONE is a label of the exit, not of the blocked slab`);
    }
    const sources = [];
    const walk = (dir) => {
      for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(rel);
        else if (/\.(css|astro)$/.test(entry.name)) sources.push(rel);
      }
    };
    walk('src');
    const users = sources.filter((f) => /var\(\s*--block\b/.test(stripComments(read(f))));
    assert.deepEqual(users, ['src/styles/pipeline.css'], 'only pipeline.css uses var(--block)');
    assert.doesNotMatch(read('src/components/marketing/PipelineDiagram.astro'), /--block/, 'the component source never names the block token');
  });
});
