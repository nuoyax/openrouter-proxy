/**
 * OpenRouter 代理服务
 * - 本机或服务器部署，转发到 OpenRouter，可配置 HTTP 代理访问 OpenRouter
 * - 支持指定模型，或使用 openrouter/auto 按响应速度自动在免费模型间切换
 */
import 'dotenv/config';
import http from 'node:http';
import { Readable } from 'node:stream';
import { config } from './config.js';
import { forwardToOpenRouter } from './proxy.js';
import { getFreeModels } from './freeModels.js';

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
  const replyError = (status, message) => {
    try {
      if (!res.writableEnded) {
        sendJson(res, status, { error: { message } });
      }
    } catch (_) {}
  };

  try {
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
      replyError(400, '无效的 JSON 请求体');
      return;
    }

    const openRouterPath = pathname === '/v1/chat/completions' ? '/api/v1/chat/completions' : pathname;
    let result;
    try {
      result = await forwardToOpenRouter(req, body, openRouterPath);
    } catch (e) {
      console.error('[forwardToOpenRouter]', e);
      replyError(502, '转发到 OpenRouter 失败: ' + (e?.message || String(e)));
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
      const readable = Readable.fromWeb(result.stream);
      readable.on('error', (err) => {
        if (!res.writableEnded) {
          console.error('[stream]', err?.message || err);
          res.destroy();
        }
      });
      res.on('error', () => readable.destroy());
      readable.pipe(res);
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
    replyError(502, '未知响应');
  } catch (e) {
    console.error('[handleRequest]', e);
    replyError(502, e?.message || String(e));
  }
}

const server = http.createServer(handleRequest);

server.on('error', (err) => {
  console.error('[server]', err?.message || err);
});

server.listen(config.port, async () => {
  console.log(`OpenRouter 代理服务已启动: http://0.0.0.0:${config.port}`);
  console.log(`  - 指定模型: 请求体 model 填具体模型 ID（如 openrouter/free）`);
  console.log(`  - 自动按速度切换: 请求体 model 填 ${config.autoModelId}`);
  if (config.httpProxy) {
    console.log('  使用代理:', config.httpProxy, '（超时默认 10s，可设置 MODEL_TIMEOUT_MS 覆盖）');
  }
  if (!config.openrouterApiKey) {
    console.warn('  未设置 OPENROUTER_API_KEY，请求将返回 401');
  } else if (!process.env.OPENROUTER_FREE_MODELS && process.env.FETCH_FREE_MODELS_FROM_OPENROUTER !== 'false') {
    getFreeModels().then((list) => {
      console.log(`  - 已从 OpenRouter 拉取免费模型列表，共 ${list?.length ?? 0} 个（1 小时缓存）`);
    }).catch(() => {});
  }
});

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err?.message || err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
