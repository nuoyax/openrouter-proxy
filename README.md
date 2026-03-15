# OpenRouter 中转代理（OpenClaw 可用）

通过本服务中转访问 OpenRouter，使用其免费模型。支持**指定模型**或**按响应速度自动切换**模型。

## 功能

- **指定模型**：请求体 `model` 填具体模型 ID（如 `openrouter/free`、`meta-llama/llama-3.3-70b-instruct:free`），直接转发。
- **按速度自动切换**：请求体 `model` 填 `openrouter/auto`（可通过 `AUTO_MODEL_ID` 修改），代理会从配置的免费模型列表中，根据近期响应延迟自动选择最快的模型。
- **OpenRouter 兼容**：接口与 OpenRouter 一致，`baseURL` 指向本服务即可（如 OpenClaw、OpenAI SDK）。
- **流式与非流式**：均支持。
- **可选 HTTP 代理**：若本机无法直连 OpenRouter，可配置 `HTTP_PROXY`（如 `http://127.0.0.1:7890`，须带协议头）走代理；走代理时默认超时 10s。
- **超时切换**：单模型响应超时即切换下一模型；直连默认 1s，走代理默认 10s，可通过 `MODEL_TIMEOUT_MS` 覆盖。
- **最新免费模型列表**：未配置 `OPENROUTER_FREE_MODELS` 时，自动从 OpenRouter `GET /api/v1/models` 拉取当前免费模型（1 小时缓存），避免旧模型 404。

## 环境要求

- Node.js >= 18

## 配置

复制 `.env.example` 为 `.env`，在本地填写 `OPENROUTER_API_KEY` 等（`.env` 已加入 `.gitignore`，不会随仓库提交）：

| 变量 | 说明 |
|------|------|
| `OPENROUTER_API_KEY` | **必填**。在 [OpenRouter Keys](https://openrouter.ai/keys) 申请。 |
| `PORT` | 监听端口，默认 `10300`。 |
| `HTTP_PROXY` | 可选。访问 OpenRouter 时使用的 HTTP 代理，须带协议如 `http://127.0.0.1:7890`；未带协议会自动补 `http://`。走代理时默认超时 10s。 |
| `AUTO_MODEL_ID` | “自动按速度切换”时请求里使用的模型名，默认 `openrouter/auto`。 |
| `OPENROUTER_FREE_MODELS` | 参与自动切换的免费模型 ID，逗号分隔。不填则从 OpenRouter API 拉取最新免费模型（推荐）。 |
| `FETCH_FREE_MODELS_FROM_OPENROUTER` | 未设置上一项时，是否从 API 拉取免费模型列表，默认 `true`。设为 `false` 则使用内置默认列表。 |
| `ENABLE_LATENCY_TRACKING` | 是否记录延迟并用于自动选模型，默认 `true`。设为 `false` 则自动模式仅轮询列表第一个。 |
| `MODEL_TIMEOUT_MS` | 单模型最大响应时间（毫秒），超时则自动切换下一模型；直连默认 `1000`，配置了 `HTTP_PROXY` 时默认 `10000`。 |

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

### 3. OpenClaw 接入教程

本中转与 OpenRouter 接口兼容，OpenClaw 只需把请求的 base URL 指到本服务即可。

#### 前置条件

- 本中转服务已在本机或服务器启动（如 `http://localhost:10300`）。
- 已在本中转的 `.env` 中配置 `OPENROUTER_API_KEY`（OpenClaw 侧可不填或填占位，由中转统一带 Key）。

#### 步骤一：认证 OpenClaw（可选）

若 OpenClaw 要求配置 token，可先做一次认证（Key 可填占位，实际请求由中转带 Key）：

```bash
openclaw onboard --auth-choice apiKey --token-provider openrouter --token "sk-placeholder"
```

#### 步骤二：配置指向本中转

在 OpenClaw 的配置（如 `openclaw.json` 或对应环境变量）中：

1. **Base URL** 设为本中转地址（必改）  
   - 本机：`http://localhost:10300`  
   - 远程：`http://<服务器 IP 或域名>:10300`  
   - 若前面有 Nginx/Caddy 反向代理 HTTPS：`https://<域名>`
2. **模型** 任选其一：  
   - 自动按速度切换：填 `openrouter/auto`  
   - 指定模型：填具体 ID，如 `openrouter/free`、`stepfun/step-3.5-flash:free`

配置示例（按你实际使用的配置方式调整）：

```json
{
  "env": {
    "OPENROUTER_API_KEY": "sk-placeholder"
  },
  "agents": {
    "defaults": {
      "model": { "primary": "openrouter/auto" }
    }
  }
}
```

若 OpenClaw 支持单独设置 **API Base URL**，将其设为 `http://<本机或服务器>:10300`，不要用 `https://openrouter.ai`。

#### 步骤三：国内 / 代理环境

- 本中转部署在国内且无法直连 OpenRouter 时，在本中转的 `.env` 中配置 **可选**的 `HTTP_PROXY`（如 `http://127.0.0.1:7890`），由中转经代理访问 OpenRouter；OpenClaw 只需访问本中转，无需自己配代理。

#### 小结

| 项目     | 说明 |
|----------|------|
| Base URL | 本中转地址，如 `http://localhost:10300` |
| API Key  | OpenClaw 侧可占位；实际 Key 在中转 `.env` |
| 自动切换 | 模型填 `openrouter/auto` |
| 指定模型 | 模型填 `openrouter/free` 等具体 ID |

## 接口说明

- **POST** `/api/v1/chat/completions` 或 `/v1/chat/completions`  
  与 OpenRouter 的 chat completions 一致，请求体、流式与非流式均兼容。  
- 其他路径返回 404。

## 安全与开源

- **勿提交密钥**：仅使用 `.env` 或系统环境变量配置 `OPENROUTER_API_KEY`，不要写入代码或提交到 Git；`.env.example` 仅作模板，不含任何真实 Key。
- **对外暴露时**：建议用 Nginx/Caddy 做 HTTPS 与访问控制（IP 白名单、鉴权等）。

## License

MIT
