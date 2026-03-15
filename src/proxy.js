/**
 * 将请求转发到 OpenRouter，并支持指定模型 / 按速度自动选模型
 */
import { config } from './config.js';
import { createLatencyTracker } from './latency.js';
import { getFreeModels } from './freeModels.js';

const latencyTracker = config.enableLatencyTracking ? createLatencyTracker() : null;

async function getFetchOptions() {
  const opts = {};
  if (config.httpProxy) {
    try {
      const { ProxyAgent } = await import('undici');
      opts.dispatcher = new ProxyAgent(config.httpProxy);
    } catch (e) {
      console.warn('未安装 undici，HTTP_PROXY 将被忽略。可执行: npm install undici');
    }
  }
  return opts;
}

let fetchOptsPromise = null;

async function getFetchOpts() {
  if (fetchOptsPromise === null) fetchOptsPromise = getFetchOptions();
  return fetchOptsPromise;
}

/**
 * 若请求体里是“自动模型”，则从免费模型列表里按延迟选一个并改写 body；可排除已超时的模型
 */
function resolveModel(body, autoModelId, freeModelsList, exclude = new Set()) {
  const model = body?.model;
  if (model !== autoModelId) return body;
  const list = freeModelsList ?? config.freeModels;
  if (!list.length) return { ...body, model: 'openrouter/free' };
  const chosen = latencyTracker?.pickFastest(list, exclude) ?? list.find((m) => !exclude.has(m)) ?? list[0];
  return { ...body, model: chosen };
}

const TIMEOUT_LATENCY_MS = 60000; // 超时记为 60s，便于自动切换时避开该模型

/**
 * 单次请求（带超时），超时抛出 DOMException AbortError
 */
async function fetchWithTimeout(url, resolved, headers, opts) {
  const signal = AbortSignal.timeout(config.modelTimeoutMs);
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(resolved),
    signal,
    ...opts,
  });
  return res;
}

/**
 * 转发到 OpenRouter 的 POST /api/v1/chat/completions（及同路径流式）
 * 自动模式下单模型超时（默认 1s）会切换下一个模型重试
 */
export async function forwardToOpenRouter(req, body, pathname) {
  const base = config.openrouterBase.replace(/\/$/, '');
  const path = pathname || '/api/v1/chat/completions';
  const url = `${base}${path}`;
  const apiKey = config.openrouterApiKey;

  if (!apiKey) {
    return { status: 401, json: { error: { message: '未配置 OPENROUTER_API_KEY' } } };
  }

  const isAuto = body?.model === config.autoModelId;
  const freeModelsList = isAuto ? await getFreeModels() : config.freeModels;
  const excluded = new Set();
  const opts = await getFetchOpts();
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    ...(req.headers['http-referer'] && { 'HTTP-Referer': req.headers['http-referer'] }),
    ...(req.headers['x-openrouter-title'] && { 'X-OpenRouter-Title': req.headers['x-openrouter-title'] }),
  };

  for (;;) {
    const resolved = resolveModel(body, config.autoModelId, freeModelsList, excluded);
    const list = freeModelsList.filter((m) => !excluded.has(m));
    if (isAuto && list.length === 0) {
      return { status: 504, json: { error: { message: '所有模型均超时，请稍后重试' } } };
    }

    const start = Date.now();
    let res;
    try {
      res = await fetchWithTimeout(url, resolved, headers, opts);
    } catch (err) {
      if (err?.name === 'AbortError' || err?.name === 'TimeoutError') {
        if (latencyTracker && resolved.model) {
          latencyTracker.record(resolved.model, TIMEOUT_LATENCY_MS);
        }
        excluded.add(resolved.model);
        if (isAuto && list.length > 1) continue;
        return { status: 504, json: { error: { message: `模型响应超时（${config.modelTimeoutMs}ms），可重试或更换模型` } } };
      }
      throw err;
    }

    const latencyMs = Date.now() - start;
    if (latencyTracker && resolved.model) {
      latencyTracker.record(resolved.model, latencyMs);
    }

    const contentType = res.headers.get('content-type') || '';
    const isStream = contentType.includes('text/event-stream') || res.headers.get('transfer-encoding') === 'chunked';

    if (isStream) {
      return { status: res.status, stream: res.body, headers: Object.fromEntries(res.headers) };
    }

    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      return { status: res.status, text };
    }
    return { status: res.status, json };
  }
}
