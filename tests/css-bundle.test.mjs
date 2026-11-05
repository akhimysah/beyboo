import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {BUNDLE_PATH, INDEX_PATH, LINK_PATTERN, PUBLIC_DIR, buildBundle, stylesheetLinks} from '../scripts/bundle-css.mjs';

test('the stylesheet list starts with style.css and every file exists', () => {
  const links = stylesheetLinks();
  assert.ok(links.length >= 2);
  assert.equal(links[0].file, 'style.css', 'style.css must come first so later files can override it');
  for (const {file} of links) assert.ok(existsSync(join(PUBLIC_DIR, file)), `${file} is missing from public/`);
});

test('beyboo.bundle.css and the hash stamped in both pages match the current stylesheets', () => {
  const {css, hash} = buildBundle();
  assert.equal(readFileSync(BUNDLE_PATH, 'utf8'), css, 'public/beyboo.bundle.css is out of date. Run: npm run bundle:css');
  for (const page of [INDEX_PATH, join(PUBLIC_DIR, 'index-en.html')]) {
    const html = readFileSync(page, 'utf8');
    assert.match(html, LINK_PATTERN, page + ' must link the bundle');
    assert.ok(html.includes(`beyboo.bundle.css?v=${hash}`), page + ' links a stale bundle hash. Run: npm run bundle:css, then regenerate the English page');
    assert.equal((html.match(/rel="stylesheet"/g) || []).length, 1, page + ' should load one stylesheet');
    assert.equal((html.match(/<script>/g) || []).length, 0, page + ' must not contain inline scripts (CSP)');
  }
});
