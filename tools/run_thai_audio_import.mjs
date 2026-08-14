export function createPacedFetch(fetchImpl = fetch, {
  gapMs = 1200,
  nowFn = () => Date.now(),
  sleepFn = ms => new Promise(resolve => setTimeout(resolve, ms)),
  retryDelays = [2000, 5000, 10000],
  maxRetryAfterMs = 15000
} = {}) {
  let chain = Promise.resolve();
  let lastStartedAt = null;

  async function run(url, options) {
    if (lastStartedAt !== null) {
      const wait = Math.max(0, gapMs - (nowFn() - lastStartedAt));
      if (wait > 0) await sleepFn(wait);
    }
    lastStartedAt = nowFn();

    let response;
    for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
      response = await fetchImpl(url, options);
      if (response.status !== 429 && response.status !== 503) return response;
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

  return (url, options) => {
    const result = chain.then(() => run(url, options));
    chain = result.catch(() => {});
    return result;
  };
}
