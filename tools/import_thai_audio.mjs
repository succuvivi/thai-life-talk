export function extractLinguaLibreTarget(title) {
  const value = String(title || '');
  if (!/^File:LL-Q\d+ \(tha\)-/u.test(value)) return null;
  const base = value.replace(/^File:/, '').replace(/\.[^.]+$/, '');
  const dash = base.lastIndexOf('-');
  if (dash < 0 || dash === base.length - 1) return null;
  const target = base.slice(dash + 1).trim();
  return /[\u0E00-\u0E7F]/u.test(target) ? target : null;
}

export function linguaLibreArchiveBasename(title) {
  const value = String(title || '');
  if (!/^File:LL-Q\d+ \(tha\)-/u.test(value)) return null;
  return value.replace(/^File:/, '');
}

export function extractDirectThaiFilename(title) {
  const value = String(title || '');
  const match = value.match(/^File:(?:Th|th)-(.+)\.(?:ogg|oga|opus|mp3|wav|webm|flac)$/iu);
  if (!match) return null;
  const target = match[1].trim();
  return /[\u0E00-\u0E7F]/u.test(target) && !/[A-Za-z]/.test(target) ? target : null;
}

export function parseWiktionaryAudioMap(source) {
  const output = new Map();
  const pattern = /\["([^"]+)"\]\s*=\s*"([^"]+\.(?:ogg|oga|opus|mp3|wav|webm|flac))"/giu;
  for (const match of String(source || '').matchAll(pattern)) {
    output.set(match[1], match[2].startsWith('File:') ? match[2] : `File:${match[2]}`);
  }
  return output;
}

export function findExactThaiTargets(text, wantedThai) {
  const source = String(text || '').normalize('NFC');
  const targets = [...(wantedThai || [])]
    .map(value => String(value).normalize('NFC'))
    .sort((a, b) => b.length - a.length);
  const isThai = char => Boolean(char && /[\u0E00-\u0E7F]/u.test(char));
  const found = [];
  for (const target of targets) {
    let start = 0;
    while (start <= source.length - target.length) {
      const index = source.indexOf(target, start);
      if (index < 0) break;
      const before = index > 0 ? source[index - 1] : '';
      const afterIndex = index + target.length;
      const after = afterIndex < source.length ? source[afterIndex] : '';
      if (!isThai(before) && !isThai(after)) {
        found.push(target);
        break;
      }
      start = index + 1;
    }
  }
  return [...new Set(found)];
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extValue(meta, key) {
  return meta?.[key]?.value ?? '';
}

export function descriptionTargetRefs(page, wantedThai) {
  const info = page?.imageinfo?.[0];
  const meta = info?.extmetadata || {};
  const description = [
    stripHtml(extValue(meta, 'ImageDescription')),
    stripHtml(extValue(meta, 'ObjectName'))
  ].filter(Boolean).join(' ');
  return findExactThaiTargets(description, wantedThai).map(target => ({
    title: page.title,
    target,
    source: 'Wikimedia Commons / exact Thai description'
  }));
}

export function isSupportedAudioFile(title, mime) {
  const value = String(title || '').toLowerCase();
  const type = String(mime || '').toLowerCase();
  if (type.startsWith('audio/')) return true;
  if (type === 'application/ogg' || type === 'application/opus') return true;
  return /\.(?:ogg|oga|opus|mp3|wav|wave|webm|flac)$/i.test(value);
}

export function isAllowedAudioLicense(license) {
  const value = String(license || '').trim();
  if (!value) return false;
  return /^(CC0|Public domain|PD|CC BY-SA|CC BY)(?:\s|$)/i.test(value);
}

function licenseRank(license) {
  const value = String(license || '');
  if (/^CC0(?:\s|$)/i.test(value)) return 0;
  if (/^(Public domain|PD)(?:\s|$)/i.test(value)) return 1;
  if (/^CC BY(?:\s|$)/i.test(value)) return 2;
  if (/^CC BY-SA(?:\s|$)/i.test(value)) return 3;
  return 99;
}

function sourceRank(source) {
  const value = String(source || '');
  if (value.includes('Lingua Libre')) return 0;
  if (value.includes('exact Thai description')) return 1;
  if (value.includes('direct Thai filename')) return 2;
  if (value.includes('Wiktionary')) return 3;
  return 9;
}

export function chooseBestCandidate(candidates) {
  return [...(candidates || [])]
    .filter(candidate => candidate?.target && candidate?.url && isAllowedAudioLicense(candidate.license))
    .sort((a, b) => licenseRank(a.license) - licenseRank(b.license)
      || sourceRank(a.source) - sourceRank(b.source)
      || Number(a.size || Number.MAX_SAFE_INTEGER) - Number(b.size || Number.MAX_SAFE_INTEGER)
      || String(a.title).localeCompare(String(b.title)))[0] || null;
}

export function buildAudioAssignments(entries, selectedByThai) {
  const output = {};
  for (const entry of entries || []) {
    const candidate = selectedByThai.get(entry.th);
    if (candidate?.localPath) output[entry.id] = candidate.localPath;
  }
  return output;
}

export function canonicalizeMediaUrl(value) {
  const url = new URL(value);
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_')) url.searchParams.delete(key);
  }
  return url.toString();
}

export function interDownloadDelayMs(processedRemoteDownloads, configuredDelayMs = 1200) {
  const delay = Number(configuredDelayMs);
  if (!Number.isFinite(delay) || delay <= 0 || processedRemoteDownloads <= 0) return 0;
  return delay;
}

export async function fetchWithRateLimitRetry(url, {
  fetchImpl = fetch,
  sleepFn = ms => new Promise(resolve => setTimeout(resolve, ms)),
  retryDelays = [2000, 5000, 10000, 20000],
  maxRetryAfterMs = 15000,
  headers = {}
} = {}) {
  const target = canonicalizeMediaUrl(url);
  let response;
  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    response = await fetchImpl(target, { headers });
    if (response.status !== 429) return response;
    if (attempt === retryDelays.length) return response;
    const retryAfterSeconds = Number(response.headers?.get?.('retry-after'));
    const requested = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? retryAfterSeconds * 1000
      : retryDelays[attempt];
    const capped = Number.isFinite(maxRetryAfterMs) && maxRetryAfterMs > 0
      ? Math.min(requested, maxRetryAfterMs)
      : requested;
    await sleepFn(Math.max(retryDelays[attempt], capped));
  }
  return response;
}
