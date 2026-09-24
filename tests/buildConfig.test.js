import { test } from 'node:test';
import assert from 'node:assert/strict';
import viteConfig from '../vite.config.js';

const resolve = (mode) => viteConfig({ command: 'build', mode });

test('GitHub Pages build (default mode) keeps relative asset paths', () => {
  assert.equal(resolve('production').base, './');
});

test('Cloudflare Pages build serves assets from the domain root', () => {
  assert.equal(resolve('cloudflare').base, '/');
});

test('unknown modes fall back to the GitHub Pages base', () => {
  assert.equal(resolve('staging').base, './');
});
