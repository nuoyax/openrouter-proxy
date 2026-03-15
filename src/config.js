/**
 * 从环境变量读取配置
 */
const OPENROUTER_BASE = 'https://openrouter.ai';

// 常用免费模型（可被自动切换使用），可从环境变量覆盖，逗号分隔
const DEFAULT_FREE_MODELS = [
  'openrouter/free',                    // 官方免费路由，自动选模型
  'stepfun/step-3.5-flash:free',        // StepFun Step 3.5 Flash (free)
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-2-9b-it:free',
  'mistralai/mistral-7b-instruct:free',
  'huggingfaceh4/zephyr-7b-beta:free',
  'nousresearch/nous-capybara-34b:free',
  'openchat/openchat-7b:free',
  'teknium/openhermes-2.5-mistral-7b:free',
];

function parseEnvList(key, fallback) {
  const raw = process.env[key];
  if (raw == null || raw === '') return fallback;
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

export const config = {
  port: Number(process.env.PORT) || 10300,
  openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
  openrouterBase: process.env.OPENROUTER_BASE || OPENROUTER_BASE,
  /** 自动模式使用的免费模型列表，按优先级/速度会调整顺序 */
  freeModels: parseEnvList('OPENROUTER_FREE_MODELS', DEFAULT_FREE_MODELS),
  /** 用于“按速度自动切换”的模型名，请求里写这个会从 freeModels 里选 */
  autoModelId: process.env.AUTO_MODEL_ID || 'openrouter/auto',
  /** 是否启用延迟统计（用于自动选最快模型） */
  enableLatencyTracking: process.env.ENABLE_LATENCY_TRACKING !== 'false',
  /** 代理请求到 OpenRouter 时使用的 HTTP(S) 代理，例如 http://127.0.0.1:7890 */
  httpProxy: (() => {
    const raw = process.env.HTTP_PROXY || process.env.http_proxy || '';
    if (!raw.trim()) return '';
    const s = raw.trim();
    return s.startsWith('http://') || s.startsWith('https://') ? s : `http://${s}`;
  })(),
  /** 单模型最大响应时间（毫秒），超时则自动切换模型重试；走代理时默认 10s，否则 1s */
  modelTimeoutMs: Number(process.env.MODEL_TIMEOUT_MS) || ((process.env.HTTP_PROXY || process.env.http_proxy) ? 10000 : 1000),
};
