import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const learn = readFileSync(new URL('../learn.html', import.meta.url), 'utf8');
const audioSources = readFileSync(new URL('../audio-sources.html', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('standalone site uses Thai Life Talk branding and public URL', () => {
  assert.match(index, /Thai Life Talk/);
  assert.match(index, /泰国生活口语 · 真实场景开口就用/);
  assert.match(index, /360 个高频词/);
  assert.match(index, /18 个生活场景/);
  assert.match(readme, /https:\/\/succuvivi\.github\.io\/thai-life-talk\//);
  assert.doesNotMatch(index + readme, /English Deep Talk/);
  assert.doesNotMatch(readme, /english-deep-talk-plan\/thai/);
  assert.match(learn, /Thai Life Talk/);
  assert.match(audioSources, /Thai Life Talk/);
  assert.equal(pkg.name, 'thai-life-talk');
});
