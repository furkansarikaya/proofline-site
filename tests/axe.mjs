// Browser accessibility check (TASK-001): run only by `npm run test:axe`, never by `node --test` discovery.
// Serves dist/ with scripts/serve-dist.mjs, drives the Playwright library's Chromium and scans with axe.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';
import { startServer } from '../scripts/serve-dist.mjs';
import { makeTempDir, removeTempDirs, sweepStale } from './temp-dirs.mjs';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
sweepStale();

/** Navigate, require status 200 (a 404 body is never scanned as a pass), then require 0 axe violations. */
async function expectNoViolations(page, url) {
  let status = 0;
  try {
    const response = await page.goto(url);
    status = response ? response.status() : 0;
  } catch {
    status = 0;
  }
  assert.equal(status, 200, `${url} must answer 200 before it is scanned`);
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`).join('\n');
  assert.equal(violations.length, 0, `axe found ${violations.length} violation(s) at ${url}:\n${summary}`);
}

describe('accessibility', () => {
  let browser;
  let context;
  let site;
  let fixture;
  let fixtureDir;

  before(async () => {
    site = await startServer({ root: dist });
    fixtureDir = makeTempDir('proofline-axe-');
    writeFileSync(join(fixtureDir, 'index.html'), '<!doctype html><head><meta charset="utf-8"><title>Known violation</title></head><body><main><h1>Known violation</h1><img src="x.png"></main></body>');
    fixture = await startServer({ root: fixtureDir });
    browser = await chromium.launch();
    context = await browser.newContext();
  }, { timeout: 120000 });

  after(async () => {
    try {
      await context?.close();
      await browser?.close();
      await site?.close();
      await fixture?.close();
    } finally {
      removeTempDirs();
    }
  });

  it('axe finds 0 violations on / and /tr/ and fails on a page with a known violation', async () => {
    const page = await context.newPage();
    await expectNoViolations(page, `${site.url}/`);
    await expectNoViolations(page, `${site.url}/tr/`);
    await assert.rejects(expectNoViolations(page, `${fixture.url}/`), (error) => {
      assert.match(error.message, /image-alt/);
      return true;
    });
    await page.close();
  });
});
