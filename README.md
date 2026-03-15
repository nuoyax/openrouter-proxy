# OpenRouter 中转代理（OpenClaw 可用）

通过本服务中转访问 OpenRouter，使用其免费模型。支持**指定模型**或**按响应速度自动切换**模型。

## 功能

- **指定模型**：请求体 `model` 填具体模型 ID（如 `openrouter/free`、`meta-llama/llama-3.3-70b-instruct:free`），直接转发。
- **按速度自动切换**：请求体 `model` 填 `openrouter/auto`（可通过 `AUTO_MODEL_ID` 修改），代理会从配置的免费模型列表中，根据近期响应延迟自动选择最快的模型。
- **OpenRouter 兼容**：接口与 OpenRouter 一致，`baseURL` 指向本服务即可（如 OpenClaw、OpenAI SDK）。
- **流式与非流式**：均支持。
- **可选 HTTP 代理**：若本机无法直连 OpenRouter，可配置 `HTTP_PROXY` 走代理（需安装 `undici`）。
- **超时切换**：单模型响应超过 1s（可配置）即视为超时，自动模式会切换下一个模型重试。

## 环境要求

- Node.js >= 18

## 配置

复制 `.env.example` 为 `.env`，在本地填写 `OPENROUTER_API_KEY` 等（`.env` 已加入 `.gitignore`，不会随仓库提交）：

| 变量 | 说明 |
|------|------|
| `OPENROUTER_API_KEY` | **必填**。在 [OpenRouter Keys](https://openrouter.ai/keys) 申请。 |
| `PORT` | 监听端口，默认 `10300`。 |
| `HTTP_PROXY` | 可选。访问 OpenRouter 时使用的 HTTP 代理，如 `http://127.0.0.1:7890`。使用时代码会尝试用 `undici` 的 `ProxyAgent`。 |
| `AUTO_MODEL_ID` | “自动按速度切换”时请求里使用的模型名，默认 `openrouter/auto`。 |
| `OPENROUTER_FREE_MODELS` | 参与自动切换的免费模型 ID，逗号分隔。不填则使用内置列表。 |
| `ENABLE_LATENCY_TRACKING` | 是否记录延迟并用于自动选模型，默认 `true`。设为 `false` 则自动模式仅轮询列表第一个。 |
| `MODEL_TIMEOUT_MS` | 单模型最大响应时间（毫秒），超时则自动切换下一个模型重试，默认 `1000`。 |

## 安装与运行

```bash
cd openrouter-proxy
npm install
npm start
```

开发时可加监听重启：

```bash
npm run dev
```

## 使用方式

### 1. 指定模型（直接转发）

```bash
curl -X POST http://localhost:10300/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openrouter/free",
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

### 2. 按速度自动切换模型

```bash
curl -X POST http://localhost:10300/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openrouter/auto",
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

代理会从 `OPENROUTER_FREE_MODELS`（或内置免费模型列表）中，根据近期延迟选择当前最快的模型；无历史数据时使用列表第一个。

### 3. 在 OpenClaw 中使用

将 OpenClaw 请求的 base URL 指向本中转服务（API Key 仅在中转服务端配置，客户端无需持有）：

- Base URL：`http://<本机或服务器>:10300`（若经反向代理可改为 `https://...`）。
- 指定模型：在 OpenClaw 中填写具体模型 ID。
- 自动切换：模型填 `openrouter/auto`（或你设置的 `AUTO_MODEL_ID`）。

## 接口说明

- **POST** `/api/v1/chat/completions` 或 `/v1/chat/completions`  
  与 OpenRouter 的 chat completions 一致，请求体、流式与非流式均兼容。  
- 其他路径返回 404。

## 安全与开源

- **勿提交密钥**：仅使用 `.env` 或系统环境变量配置 `OPENROUTER_API_KEY`，不要写入代码或提交到 Git；`.env.example` 仅作模板，不含任何真实 Key。
- **对外暴露时**：建议用 Nginx/Caddy 做 HTTPS 与访问控制（IP 白名单、鉴权等）。

## License

MIT
