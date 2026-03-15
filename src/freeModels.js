/**
 * 从 OpenRouter API 拉取当前免费模型列表，带缓存与回退
 */
import { config } from './config.js';

const CACHE_MS = 60 * 60 * 1000; // 1 小时
let cached = null;
let cachedAt = 0;

function isFreePricing(pricing) {
  if (!pricing) return false;
  const p = Array.isArray(pricing) ? pricing[0] : pricing;
  if (!p) return false;
  const prompt = Number(p.prompt ?? p.prompt_token ?? 0);
  const completion = Number(p.completion ?? p.completion_token ?? 0);
  return prompt === 0 && completion === 0;
}

/**
 * 请求 GET /api/v1/models，过滤出定价为 0 的模型 ID 列表
 */
export async function fetchOpenRouterFreeModels() {
  const base = config.openrouterBase.replace(/\/$/, '');
  const url = `${base}/api/v1/models`;
  const apiKey = config.openrouterApiKey;
  if (!apiKey) return null;

  let fetchFn = globalThis.fetch;
  let dispatcher;
  if (config.httpProxy) {
    try {
      const undici = await import('undici');
      dispatcher = new undici.ProxyAgent(config.httpProxy);
      fetchFn = undici.fetch;
    } catch (_) {}
  }

  const res = await fetchFn(url, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    dispatcher,
  });
  if (!res.ok) return null;

  const json = await res.json();
  const data = json?.data ?? json?.models ?? [];
  if (!Array.isArray(data)) return null;

  const ids = data
    .filter((m) => m?.id && (isFreePricing(m.pricing) || String(m.id).endsWith(':free')))
    .map((m) => m.id)
    .filter(Boolean);
  // 保证 openrouter/free 在列，便于回退
  if (ids.length && !ids.includes('openrouter/free')) {
    ids.unshift('openrouter/free');
  }
  return ids.length ? ids : null;
}

/**
 * 获取自动模式使用的免费模型列表：
 * - 若设置了 OPENROUTER_FREE_MODELS，则用其值（逗号分隔）
 * - 否则若启用 FETCH_FREE_MODELS_FROM_OPENROUTER，则从 OpenRouter 拉取并缓存
 * - 拉取失败或未启用则使用 config.freeModels（内置默认）
 */
export async function getFreeModels() {
  const envList = process.env.OPENROUTER_FREE_MODELS;
  if (envList != null && String(envList).trim() !== '') {
    return envList.split(',').map((s) => s.trim()).filter(Boolean);
  }

  if (process.env.FETCH_FREE_MODELS_FROM_OPENROUTER === 'false') {
    return config.freeModels;
  }

  const now = Date.now();
  if (cached && now - cachedAt < CACHE_MS) {
    return cached;
  }

  const list = await fetchOpenRouterFreeModels();
  if (list && list.length) {
    cached = list;
    cachedAt = now;
    return list;
  }

  return config.freeModels;
}

/**
 * 清除缓存，下次 getFreeModels() 会重新拉取
 */
export function clearFreeModelsCache() {
  cached = null;
  cachedAt = 0;
}
