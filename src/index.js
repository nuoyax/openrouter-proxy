/**
 * OpenRouter 中转代理
 * - 国内机器部署，转发到 OpenRouter，可配置 HTTP 代理访问 OpenRouter
 * - 支持指定模型，或使用 openrouter/auto 按响应速度自动在免费模型间切换
 */
import http from 'node:http';
import { Readable } from 'node:stream';
import { config } from './config.js';
import { forwardToOpenRouter } from './proxy.js';

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function handleRequest(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, HTTP-Referer, X-OpenRouter-Title',
    });
    res.end();
    return;
  }

  const pathname = req.url?.split('?')[0];
  const isChat = pathname === '/api/v1/chat/completions' || pathname === '/v1/chat/completions';

  if (req.method !== 'POST' || !isChat) {
    sendJson(res, 404, { error: { message: '仅支持 POST /api/v1/chat/completions（或 /v1/chat/completions）' } });
    return;
  }

  let body;
  try {
    body = await parseBody(req);
  } catch (e) {
    sendJson(res, 400, { error: { message: '无效的 JSON 请求体' } });
    return;
  }

  const openRouterPath = pathname === '/v1/chat/completions' ? '/api/v1/chat/completions' : pathname;
  let result;
  try {
    result = await forwardToOpenRouter(req, body, openRouterPath);
  } catch (e) {
    console.error(e);
    sendJson(res, 502, { error: { message: '转发到 OpenRouter 失败: ' + (e.message || String(e)) } });
    return;
  }

  if (result.stream) {
    res.writeHead(result.status, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      ...result.headers,
    });
    Readable.fromWeb(result.stream).pipe(res);
    return;
  }

  if (result.json != null) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    sendJson(res, result.status, result.json);
    return;
  }
  if (result.text != null) {
    res.writeHead(result.status, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
    res.end(result.text);
    return;
  }
  sendJson(res, 502, { error: { message: '未知响应' } });
}

const server = http.createServer(handleRequest);
server.listen(config.port, () => {
  console.log(`OpenRouter 中转已启动: http://0.0.0.0:${config.port}`);
  console.log(`  - 指定模型: 请求体 model 填具体模型 ID（如 openrouter/free）`);
  console.log(`  - 自动按速度切换: 请求体 model 填 ${config.autoModelId}`);
  if (!config.openrouterApiKey) {
    console.warn('  未设置 OPENROUTER_API_KEY，请求将返回 401');
  }
});
