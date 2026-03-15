<div align="center">

# 🔀 OpenRouter 中转代理

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![npm](https://img.shields.io/badge/npm-1.0.0-CB3837?logo=npm&logoColor=white)](./package.json)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![OpenRouter](https://img.shields.io/badge/OpenRouter-API-1a1a2e?logo=openai&logoColor=white)](https://openrouter.ai/)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-兼容-0066cc)](https://open-claw.bot/)

**国内可用 · OpenClaw 即接即用**

通过本服务中转访问 OpenRouter，使用免费模型。支持 **指定模型** 或 **按响应速度自动切换** 模型。

[功能](#-功能) · [快速开始](#-快速开始) · [配置](#-配置) · [OpenClaw 接入](#-openclaw-接入教程) · [接口](#-接口说明)

</div>

---

## ✨ 功能

| 能力 | 说明 |
|------|------|
| 🎯 **指定模型** | 请求体 `model` 填具体 ID（如 `openrouter/free`），直接转发。 |
| ⚡ **按速度自动切换** | `model` 填 `openrouter/auto`，从免费模型中按近期延迟选最快的。 |
| 🔌 **OpenRouter 兼容** | 接口一致，`baseURL` 指向本服务即可（OpenClaw、OpenAI SDK 等）。 |
| 📡 **流式 / 非流式** | 均支持。 |
| 🌐 **可选 HTTP 代理** | 配置 `HTTP_PROXY` 经代理访问 OpenRouter；走代理时默认超时 10s。 |
| ⏱️ **超时自动切换** | 单模型超时即换下一个；直连默认 1s，走代理默认 10s，可配置。 |
| 📋 **最新免费模型列表** | 未配置列表时从 OpenRouter API 拉取并缓存 1 小时，避免 404。 |

---

## 🚀 快速开始

**环境**：Node.js >= 18

```bash
cd openrouter-proxy
npm install
npm start
```

开发时监听文件变化自动重启：

```bash
npm run dev
```

服务默认监听 `http://0.0.0.0:10300`。在 `.env` 中配置 **必填** 的 `OPENROUTER_API_KEY` 后即可请求。

---

## ⚙️ 配置

复制 `.env.example` 为 `.env`，在本地填写（`.env` 已加入 `.gitignore`，不会提交）：

| 变量 | 说明 |
|------|------|
| `OPENROUTER_API_KEY` | **必填**。在 [OpenRouter Keys](https://openrouter.ai/keys) 申请。 |
| `PORT` | 监听端口，默认 `10300`。 |
| `HTTP_PROXY` | **可选**。代理地址，须带协议如 `http://127.0.0.1:7890`；走代理时默认超时 10s。 |
| `AUTO_MODEL_ID` | 自动切换时使用的模型名，默认 `openrouter/auto`。 |
| `OPENROUTER_FREE_MODELS` | 参与自动切换的免费模型 ID，逗号分隔；不填则从 API 拉取（推荐）。 |
| `FETCH_FREE_MODELS_FROM_OPENROUTER` | 是否从 API 拉取免费模型列表，默认 `true`。 |
| `ENABLE_LATENCY_TRACKING` | 是否记录延迟用于自动选模型，默认 `true`。 |
| `MODEL_TIMEOUT_MS` | 单模型最大响应时间（毫秒）；直连默认 `1000`，有代理时默认 `10000`。 |

---

## 📖 使用方式

### 1️⃣ 指定模型（直接转发）

```bash
curl -X POST http://localhost:10300/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "openrouter/free", "messages": [{"role": "user", "content": "你好"}]}'
```

### 2️⃣ 按速度自动切换模型

```bash
curl -X POST http://localhost:10300/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "openrouter/auto", "messages": [{"role": "user", "content": "你好"}]}'
```

代理会从免费模型列表中按近期延迟选最快的；无历史数据时用列表第一个。

---

## 🐾 OpenClaw 接入教程

本中转与 OpenRouter 接口兼容，OpenClaw 只需把请求的 **Base URL** 指到本服务即可。

#### 前置条件

- 本中转服务已启动（如 `http://localhost:10300`）。
- 已在本中转的 `.env` 中配置 `OPENROUTER_API_KEY`（OpenClaw 侧可填占位，由中转统一带 Key）。

#### 步骤一：认证 OpenClaw（可选）

若 OpenClaw 要求配置 token，可先执行（Key 可占位）：

```bash
openclaw onboard --auth-choice apiKey --token-provider openrouter --token "sk-placeholder"
```

#### 步骤二：配置指向本中转

在 OpenClaw 配置（如 `openclaw.json`）中：

1. **Base URL** 设为本中转地址（必改）  
   - 本机：`http://localhost:10300`  
   - 远程：`http://<服务器 IP 或域名>:10300`  
   - 有反向代理 HTTPS：`https://<域名>`
2. **模型** 二选一：  
   - 自动切换：`openrouter/auto`  
   - 指定模型：`openrouter/free`、`stepfun/step-3.5-flash:free` 等

配置示例：

```json
{
  "env": { "OPENROUTER_API_KEY": "sk-placeholder" },
  "agents": {
    "defaults": { "model": { "primary": "openrouter/auto" } }
  }
}
```

若支持单独设置 **API Base URL**，设为 `http://<本机或服务器>:10300`，不要用 `https://openrouter.ai`。

#### 步骤三：国内 / 代理环境

本中转在国内且无法直连 OpenRouter 时，在本中转 `.env` 中配置 **可选** 的 `HTTP_PROXY`（如 `http://127.0.0.1:7890`），由中转经代理访问；OpenClaw 只需访问本中转，无需自建代理。

#### 小结

| 项目 | 说明 |
|------|------|
| Base URL | 本中转地址，如 `http://localhost:10300` |
| API Key | OpenClaw 侧可占位；实际 Key 在中转 `.env` |
| 自动切换 | 模型填 `openrouter/auto` |
| 指定模型 | 模型填 `openrouter/free` 等具体 ID |

---

## 📡 接口说明

- **POST** `/api/v1/chat/completions` 或 `/v1/chat/completions`  
  与 OpenRouter chat completions 一致，请求体、流式与非流式均兼容。
- 其他路径返回 404。

---

## 🔒 安全与开源

- **勿提交密钥**：仅用 `.env` 或环境变量配置 `OPENROUTER_API_KEY`，不要写入代码或提交；`.env.example` 仅作模板。
- **对外暴露时**：建议用 Nginx/Caddy 做 HTTPS 与访问控制（IP 白名单、鉴权等）。

---

<div align="center">

**License** · [MIT](LICENSE)

</div>
