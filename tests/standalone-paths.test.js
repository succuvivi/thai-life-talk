import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

test('standalone pages do not depend on old embedded paths or branding', () => {
  for (const file of ['index.html', 'learn.html', 'audio-sources.html']) {
    const text = read(file);
    assert.doesNotMatch(text, /(?:href|src)=["']\/thai\//);
    assert.doesNotMatch(text, /english-deep-talk-plan/);
  }
});

test('standalone root contains runtime assets and every manifested human recording', () => {
  for (const file of ['learn.html', 'styles.css', 'js/learn.js', 'js/audio.js', 'data/index.js', 'audio/sources.json']) {
    assert.ok(existsSync(fileURLToPath(new URL(`../${file}`, import.meta.url))), `missing ${file}`);
  }
  const manifest = JSON.parse(read('audio/sources.json'));
  for (const row of manifest) {
    const relative = row.localPath.replace(/^\.\//, '');
    assert.ok(existsSync(fileURLToPath(new URL(`../${relative}`, import.meta.url))), `missing ${relative}`);
  }
});
