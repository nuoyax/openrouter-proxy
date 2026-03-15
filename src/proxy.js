/**
 * 将请求转发到 OpenRouter，并支持指定模型 / 按速度自动选模型
 */
import { config } from './config.js';
import { createLatencyTracker } from './latency.js';

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
 * 若请求体里是“自动模型”，则从免费模型里按延迟选一个并改写 body
 */
function resolveModel(body, autoModelId) {
  const model = body?.model;
  if (model !== autoModelId) return body;
  const list = config.freeModels;
  if (!list.length) return { ...body, model: 'openrouter/free' };
  const chosen = latencyTracker?.pickFastest(list) ?? list[0];
  return { ...body, model: chosen };
}

/**
 * 转发到 OpenRouter 的 POST /api/v1/chat/completions（及同路径流式）
 */
export async function forwardToOpenRouter(req, body, pathname) {
  const base = config.openrouterBase.replace(/\/$/, '');
  const path = pathname || '/api/v1/chat/completions';
  const url = `${base}${path}`;
  const apiKey = config.openrouterApiKey;

  if (!apiKey) {
    return { status: 401, json: { error: { message: '未配置 OPENROUTER_API_KEY' } } };
  }

  const resolved = resolveModel(body, config.autoModelId);
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    ...(req.headers['http-referer'] && { 'HTTP-Referer': req.headers['http-referer'] }),
    ...(req.headers['x-openrouter-title'] && { 'X-OpenRouter-Title': req.headers['x-openrouter-title'] }),
  };

  const start = Date.now();
  const opts = await getFetchOpts();
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(resolved),
    ...opts,
  });

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
