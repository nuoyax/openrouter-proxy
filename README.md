<div align="center">

# 🔀 OpenRouter 中转代理

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![npm](https://img.shields.io/badge/npm-1.0.0-CB3837?logo=npm&logoColor=white)](./package.json)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![OpenRouter](https://img.shields.io/badge/OpenRouter-API-1a1a2e?logo=openai&logoColor=white)](https://openrouter.ai/)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-兼容-0066cc)](https://open-claw.bot/)

**让 OpenClaw 与各类客户端稳定使用 OpenRouter 免费模型**

[OpenRouter](https://openrouter.ai/) 提供统一 API 与大量免费模型，但直连有时不稳定或受网络限制；OpenClaw、各类 SDK 又通常只认一个 Base URL。本仓库是一个 **轻量级中转服务**：部署在你本机或服务器后，所有请求先到中转，再由中转（可选经 HTTP 代理）访问 OpenRouter，对你现有的客户端来说只是换了一个 Base URL。

- **指定模型**：请求里写具体模型 ID（如 `openrouter/free`），原样转发。  
- **按速度自动切换**：写 `openrouter/auto`，中转会从免费模型里按近期延迟自动选最快的，单模型超时则换下一个。  
- **支持代理**：可配置 `HTTP_PROXY`，由中转统一走代理，客户端无需改代码。  
- **即插即用**：与 OpenRouter 接口兼容，OpenClaw、OpenAI SDK、curl 等把 Base URL 指到本服务即可。

适合在本机或内网跑 OpenClaw / 自建应用，想用 OpenRouter 免费模型、又希望稳定可用的场景。

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

本中转提供两种用法，与 OpenClaw 的配置一一对应，保证行为一致：

| 本中转能力 | 请求体 `model` 值 | OpenClaw 中 `primary` 填法（provider 名为 `orproxy` 时） |
|------------|-------------------|----------------------------------------------------------|
| **切换模型**（按延迟自动选免费模型，超时换下一个） | `openrouter/auto` | `orproxy/openrouter/auto` |
| **指定模型**（固定用某个模型，原样转发） | `openrouter/free` 或任意 OpenRouter 模型 ID | `orproxy/openrouter/free`、`orproxy/stepfun/step-3.5-flash:free` 等 |

OpenClaw 发 **POST** 到 chat completions；本中转提供 `POST /v1/chat/completions` 与 `POST /api/v1/chat/completions`，只需让 OpenClaw 的请求发到本中转即可。

### 配置步骤（推荐：`models.providers`）

1. 本中转已启动（如 `http://localhost:10300`），且 `.env` 里已配置 `OPENROUTER_API_KEY`。
2. 在 `openclaw.json` 里增加自定义 provider（下面示例里名为 `orproxy`），`baseUrl` 指到本中转；在 `models` 里列出要用到的模型 **id**，与上表一致。
3. `agents.defaults.model.primary` 按上表二选一：要**切换模型**就填 `orproxy/openrouter/auto`，要**指定模型**就填 `orproxy/openrouter/free` 等。

### 示例一：切换模型（自动选最快免费模型）

```json5
{
  "env": { "OPENROUTER_API_KEY": "sk-placeholder" },
  "agents": {
    "defaults": {
      "model": { "primary": "orproxy/openrouter/auto" }
    }
  },
  "models": {
    "mode": "merge",
    "providers": {
      "orproxy": {
        "baseUrl": "http://localhost:10300",
        "apiKey": "sk-placeholder",
        "api": "openai-completions",
        "models": [
          { "id": "openrouter/auto", "name": "自动切换（按延迟）" }
        ]
      }
    }
  }
}
```

### 示例二：指定模型（固定用某个模型）

```json5
{
  "env": { "OPENROUTER_API_KEY": "sk-placeholder" },
  "agents": {
    "defaults": {
      "model": { "primary": "orproxy/openrouter/free" }
    }
  },
  "models": {
    "mode": "merge",
    "providers": {
      "orproxy": {
        "baseUrl": "http://localhost:10300",
        "apiKey": "sk-placeholder",
        "api": "openai-completions",
        "models": [
          { "id": "openrouter/free", "name": "OpenRouter 免费" },
          { "id": "stepfun/step-3.5-flash:free", "name": "Step 3.5 Flash" }
        ]
      }
    }
  }
}
```

要换指定模型时，把 `primary` 改成 `orproxy/<模型id>`，且该 `<模型id>` 需出现在上面 `models` 数组里（如 `orproxy/stepfun/step-3.5-flash:free`）。

### 示例三：同时可用「切换」与「指定」（按需改 primary）

```json5
{
  "env": { "OPENROUTER_API_KEY": "sk-placeholder" },
  "agents": {
    "defaults": {
      "model": { "primary": "orproxy/openrouter/auto" }
    }
  },
  "models": {
    "mode": "merge",
    "providers": {
      "orproxy": {
        "baseUrl": "http://localhost:10300",
        "apiKey": "sk-placeholder",
        "api": "openai-completions",
        "models": [
          { "id": "openrouter/auto", "name": "自动切换" },
          { "id": "openrouter/free", "name": "免费" },
          { "id": "stepfun/step-3.5-flash:free", "name": "Step 3.5 Flash" }
        ]
      }
    }
  }
}
```

- 用**切换模型**：`primary` 保持 `orproxy/openrouter/auto`。
- 用**指定模型**：把 `primary` 改为 `orproxy/openrouter/free` 或 `orproxy/stepfun/step-3.5-flash:free` 等，与上面 `id` 一致即可。

### 说明

- **provider 名**：示例里用 `orproxy`，可改成任意名（如 `myopenrouter`），对应关系改为 `myopenrouter/openrouter/auto`、`myopenrouter/openrouter/free` 等。
- **baseUrl**：远程或 HTTPS 时改为 `http://<服务器>:10300` 或 `https://<域名>`。
- 本中转会把请求体里带 provider 前缀的 `model`（如 `orproxy/openrouter/auto`）规范成 `openrouter/auto` 再转发，因此上表对应关系保证无误。

### 认证（可选）

若 OpenClaw 要求先做 token 认证，可执行（Key 可占位）：

```bash
openclaw onboard --auth-choice apiKey --token-provider openrouter --token "sk-placeholder"
```

### 代理环境

本机无法直连 OpenRouter 时，在本中转 `.env` 中配置 **可选** 的 `HTTP_PROXY`；OpenClaw 只需能访问本中转即可。

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
