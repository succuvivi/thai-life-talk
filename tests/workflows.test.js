import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pathOf = file => fileURLToPath(new URL(`../.github/workflows/${file}`, import.meta.url));
const read = file => readFileSync(pathOf(file), 'utf8');

test('standalone repository defines Pages, QA, and audio import workflows', () => {
  for (const file of ['pages.yml', 'qa.yml', 'import-thai-audio.yml']) {
    assert.ok(existsSync(pathOf(file)), `missing ${file}`);
  }
  assert.match(read('pages.yml'), /Deploy Thai Life Talk to GitHub Pages/);
  assert.match(read('pages.yml'), /branches: \["main"\]/);
  assert.match(read('qa.yml'), /npm test/);
  assert.match(read('qa.yml'), /API_KEY/);
  assert.match(read('import-thai-audio.yml'), /import_thai_audio_generator\.mjs/);
  assert.doesNotMatch(read('pages.yml') + read('qa.yml') + read('import-thai-audio.yml'), /english-deep-talk-plan/);
});
