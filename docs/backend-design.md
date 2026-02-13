# ParallelLM Backend Design Document

## 1. Overview

ParallelLMのバックエンドは、複数のLLM APIを並列に呼び出し、ストリーミングレスポンスをリアルタイムでクライアントに配信する役割を担う。

### 設計原則

- **並列性**: 複数LLMへのリクエストは独立して並列実行し、1つの失敗が他に影響しない
- **ストリーミングファースト**: SSEによるリアルタイムトークン配信を基本とする
- **シンプルさ**: Next.js Route Handlersで完結し、別途バックエンドサーバーを立てない
- **拡張性**: 新しいLLMプロバイダーの追加が容易なプロバイダーパターン

---

## 2. フレームワーク選定: Next.js Route Handlers

### 選定理由

| 観点 | Next.js Route Handlers | 別途Express/Fastifyサーバー |
|------|----------------------|---------------------------|
| デプロイ | Vercel等に一括デプロイ | フロント・バック別デプロイ必要 |
| ストリーミング | Web Streams API対応 | 対応可能だが設定必要 |
| 型共有 | フロント・バックで型を直接共有 | 別パッケージ or API schema共有 |
| 開発体験 | 単一リポジトリ・単一起動 | 複数プロセス管理 |
| Edge Runtime | 対応（低レイテンシ） | 非対応 |

**結論**: Next.js App Router の Route Handlers を採用。フロントエンドと同一プロジェクトで管理し、TypeScriptの型をフロント・バックで共有する。Node.js Runtimeを使用（Edge RuntimeはLLM SDKの互換性に課題があるため）。

### ディレクトリ構成

```
src/
├── app/
│   └── api/
│       ├── chat/
│       │   └── route.ts          # メインのチャット・並列LLM呼び出し
│       ├── models/
│       │   └── route.ts          # 利用可能モデル一覧
│       └── health/
│           └── route.ts          # ヘルスチェック
├── lib/
│   ├── providers/
│   │   ├── base.ts               # プロバイダー基底インターフェース
│   │   ├── openai.ts             # OpenAI プロバイダー
│   │   ├── anthropic.ts          # Anthropic プロバイダー
│   │   ├── google.ts             # Google Gemini プロバイダー
│   │   ├── openai-compatible.ts  # OpenAI互換プロバイダー（共通基盤）
│   │   ├── groq.ts               # Groq プロバイダー（無料・OpenAI互換）
│   │   ├── openrouter.ts         # OpenRouter プロバイダー（無料モデルあり・OpenAI互換）
│   │   ├── ollama.ts             # Ollama プロバイダー（ローカル・OpenAI互換）
│   │   ├── custom-endpoint.ts    # カスタムエンドポイント（ローカル・OpenAI互換）
│   │   └── index.ts              # プロバイダーレジストリ
│   ├── streaming/
│   │   ├── sse-encoder.ts        # SSEエンコーダー
│   │   └── multi-stream.ts       # 複数ストリーム統合
│   ├── api-keys.ts               # APIキー管理
│   ├── rate-limiter.ts           # レート制限
│   └── errors.ts                 # エラー定義
└── types/
    ├── provider.ts               # プロバイダー共通型
    ├── chat.ts                   # チャット関連型
    └── api.ts                    # APIリクエスト・レスポンス型
```

---

## 3. LLM API 並列呼び出しアーキテクチャ

### 3.1 プロバイダーインターフェース

各LLMプロバイダーを統一的に扱うためのインターフェースを定義する。

```typescript
// src/types/provider.ts

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface StreamChunk {
  type: 'text' | 'error' | 'done';
  content: string;
  model: string;
  provider: string;
}

export type ProviderType = 'cloud' | 'free' | 'local';

export interface LLMProvider {
  name: string;
  type: ProviderType;
  requiresApiKey: boolean;
  baseUrl?: string;               // ローカルLLM・OpenAI互換用
  chatStream(
    request: ChatRequest,
    apiKey: string,
    signal: AbortSignal
  ): AsyncIterable<StreamChunk>;
  listModels(apiKey?: string): Promise<ModelInfo[]>;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  maxTokens: number;
  supportedFeatures: string[];
}
```

### 3.2 プロバイダー実装例

```typescript
// src/lib/providers/openai.ts

import OpenAI from 'openai';
import type { LLMProvider, ChatRequest, StreamChunk } from '@/types/provider';

export const openaiProvider: LLMProvider = {
  name: 'openai',

  async *chatStream(request, apiKey, signal): AsyncIterable<StreamChunk> {
    const client = new OpenAI({ apiKey });

    const stream = await client.chat.completions.create(
      {
        model: request.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 4096,
        stream: true,
      },
      { signal }
    );

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield {
          type: 'text',
          content,
          model: request.model,
          provider: 'openai',
        };
      }
    }

    yield { type: 'done', content: '', model: request.model, provider: 'openai' };
  },

  async listModels(apiKey) {
    // モデル一覧を返す（ハードコード + API検証）
    return [
      { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', maxTokens: 128000, supportedFeatures: ['streaming', 'function-calling'] },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', maxTokens: 128000, supportedFeatures: ['streaming', 'function-calling'] },
    ];
  },
};
```

```typescript
// src/lib/providers/anthropic.ts

import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, ChatRequest, StreamChunk } from '@/types/provider';

export const anthropicProvider: LLMProvider = {
  name: 'anthropic',

  async *chatStream(request, apiKey, signal): AsyncIterable<StreamChunk> {
    const client = new Anthropic({ apiKey });

    // Anthropic APIはsystem messageを別パラメータで渡す
    const systemMessage = request.messages.find(m => m.role === 'system');
    const nonSystemMessages = request.messages.filter(m => m.role !== 'system');

    const stream = client.messages.stream(
      {
        model: request.model,
        system: systemMessage?.content,
        messages: nonSystemMessages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0.7,
      },
      { signal }
    );

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield {
          type: 'text',
          content: event.delta.text,
          model: request.model,
          provider: 'anthropic',
        };
      }
    }

    yield { type: 'done', content: '', model: request.model, provider: 'anthropic' };
  },

  async listModels(apiKey) {
    return [
      { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', provider: 'anthropic', maxTokens: 200000, supportedFeatures: ['streaming', 'extended-thinking'] },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', provider: 'anthropic', maxTokens: 200000, supportedFeatures: ['streaming'] },
    ];
  },
};
```

### 3.3 OpenAI互換プロバイダー（ローカルLLM・Groq・OpenRouter共通）

`openai` SDKの `baseURL` を差し替えることで、Ollama・LM Studio・Groq・OpenRouterに対応する。

```typescript
// src/lib/providers/openai-compatible.ts

import OpenAI from 'openai';
import type { LLMProvider, ChatRequest, StreamChunk, ModelInfo } from '@/types/provider';

interface OpenAICompatibleConfig {
  name: string;
  type: ProviderType;
  baseUrl: string;
  requiresApiKey: boolean;
  defaultModels: ModelInfo[];
  supportsModelDiscovery: boolean;
  extraHeaders?: Record<string, string>;
}

export function createOpenAICompatibleProvider(config: OpenAICompatibleConfig): LLMProvider {
  return {
    name: config.name,
    type: config.type,
    requiresApiKey: config.requiresApiKey,
    baseUrl: config.baseUrl,

    async *chatStream(request, apiKey, signal): AsyncIterable<StreamChunk> {
      const client = new OpenAI({
        apiKey: apiKey || 'not-needed',
        baseURL: config.baseUrl,
        defaultHeaders: config.extraHeaders,
      });

      const stream = await client.chat.completions.create(
        {
          model: request.model,
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 4096,
          stream: true,
        },
        { signal }
      );

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield { type: 'text', content, model: request.model, provider: config.name };
        }
      }
      yield { type: 'done', content: '', model: request.model, provider: config.name };
    },

    async listModels(apiKey?) {
      if (config.supportsModelDiscovery) {
        try {
          const client = new OpenAI({
            apiKey: apiKey || 'not-needed',
            baseURL: config.baseUrl,
          });
          const response = await client.models.list();
          return response.data.map(m => ({
            id: m.id,
            name: m.id,
            provider: config.name,
            maxTokens: 4096,
            supportedFeatures: ['streaming'],
          }));
        } catch {
          return config.defaultModels; // フォールバック
        }
      }
      return config.defaultModels;
    },
  };
}
```

```typescript
// src/lib/providers/ollama.ts
export const ollamaProvider = createOpenAICompatibleProvider({
  name: 'ollama',
  type: 'local',
  baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
  requiresApiKey: false,
  defaultModels: [],
  supportsModelDiscovery: true, // GET /v1/models でローカルモデル一覧を動的取得
});

// src/lib/providers/groq.ts
export const groqProvider = createOpenAICompatibleProvider({
  name: 'groq',
  type: 'free',
  baseUrl: 'https://api.groq.com/openai/v1',
  requiresApiKey: true,
  defaultModels: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', provider: 'groq', maxTokens: 32768, supportedFeatures: ['streaming'] },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', provider: 'groq', maxTokens: 32768, supportedFeatures: ['streaming'] },
    { id: 'gemma2-9b-it', name: 'Gemma 2 9B', provider: 'groq', maxTokens: 8192, supportedFeatures: ['streaming'] },
  ],
  supportsModelDiscovery: false,
});

// src/lib/providers/openrouter.ts
export const openrouterProvider = createOpenAICompatibleProvider({
  name: 'openrouter',
  type: 'free',
  baseUrl: 'https://openrouter.ai/api/v1',
  requiresApiKey: true,
  defaultModels: [
    { id: 'meta-llama/llama-3.3-8b-instruct:free', name: 'Llama 3.3 8B (Free)', provider: 'openrouter', maxTokens: 8192, supportedFeatures: ['streaming'] },
    { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B (Free)', provider: 'openrouter', maxTokens: 32768, supportedFeatures: ['streaming'] },
  ],
  supportsModelDiscovery: false,
  extraHeaders: { 'HTTP-Referer': 'https://parallellm.dev' },
});

// src/lib/providers/custom-endpoint.ts — ユーザーが任意のOpenAI互換URLを指定
export function createCustomEndpointProvider(baseUrl: string, name?: string) {
  return createOpenAICompatibleProvider({
    name: name || 'custom',
    type: 'local',
    baseUrl,
    requiresApiKey: false,
    defaultModels: [],
    supportsModelDiscovery: true,
  });
}
```

### 3.4 プロバイダーレジストリ

```typescript
// src/lib/providers/index.ts

import type { LLMProvider } from '@/types/provider';
import { openaiProvider } from './openai';
import { anthropicProvider } from './anthropic';
import { googleProvider } from './google';
import { groqProvider } from './groq';
import { openrouterProvider } from './openrouter';
import { ollamaProvider } from './ollama';

const providerRegistry = new Map<string, LLMProvider>([
  // 商用API
  ['openai', openaiProvider],
  ['anthropic', anthropicProvider],
  ['google', googleProvider],
  // 無料API
  ['groq', groqProvider],
  ['openrouter', openrouterProvider],
  // ローカルLLM
  ['ollama', ollamaProvider],
]);

export function getProvider(name: string): LLMProvider {
  const provider = providerRegistry.get(name);
  if (!provider) {
    throw new Error(`Unknown provider: ${name}`);
  }
  return provider;
}

export function getProviderForModel(modelId: string): LLMProvider {
  // モデルIDからプロバイダーを特定するマッピング
  // ローカルLLMはモデルIDに "ollama/" "lmstudio/" "custom/" プレフィックスを付与して識別
  const modelProviderMap: Record<string, string> = {
    // 商用API
    'gpt-4o': 'openai',
    'gpt-4o-mini': 'openai',
    'claude-sonnet-4-5-20250929': 'anthropic',
    'claude-haiku-4-5-20251001': 'anthropic',
    'gemini-2.0-flash': 'google',
    'gemini-2.0-pro': 'google',
    // 無料API (Groq)
    'llama-3.3-70b-versatile': 'groq',
    'mixtral-8x7b-32768': 'groq',
    'gemma2-9b-it': 'groq',
    // 無料API (OpenRouter) — プレフィックス付きID
    'meta-llama/llama-3.3-8b-instruct:free': 'openrouter',
    'mistralai/mistral-7b-instruct:free': 'openrouter',
  };

  // ローカルLLMはプレフィックスで判定
  if (modelId.startsWith('ollama/')) {
    return getProvider('ollama');
  }
  if (modelId.startsWith('custom/')) {
    return getProvider('custom');
  }

  const providerName = modelProviderMap[modelId];
  if (!providerName) {
    throw new Error(`Unknown model: ${modelId}`);
  }
  return getProvider(providerName);
}

export { providerRegistry };
```

### 3.4 並列実行エンジン

```typescript
// src/lib/streaming/multi-stream.ts

import type { ChatRequest, StreamChunk } from '@/types/provider';
import { getProviderForModel } from '@/lib/providers';
import { resolveApiKey } from '@/lib/api-keys';

interface ParallelRequest {
  model: string;
  request: ChatRequest;
  userApiKeys?: Record<string, string>;
}

const DEFAULT_TIMEOUT_MS = 60_000; // 60秒

export async function* executeParallel(
  requests: ParallelRequest[]
): AsyncIterable<StreamChunk> {
  const abortControllers = requests.map(() => new AbortController());

  // 各モデルのストリームを独立して起動
  const streams = requests.map((req, index) => {
    const provider = getProviderForModel(req.model);
    const apiKey = resolveApiKey(provider.name, req.userApiKeys);

    // タイムアウト設定
    const timeoutId = setTimeout(() => {
      abortControllers[index].abort();
    }, DEFAULT_TIMEOUT_MS);

    return {
      model: req.model,
      provider: provider.name,
      iterator: provider.chatStream(
        { ...req.request, model: req.model },
        apiKey,
        abortControllers[index].signal
      ),
      timeoutId,
    };
  });

  // ReadableStreamを使って複数のAsyncIterableを統合
  // 各ストリームを並列に消費し、チャンクが来た順にyieldする
  const chunkQueue: StreamChunk[] = [];
  let resolveWait: (() => void) | null = null;
  let activeStreams = streams.length;

  const consumeStream = async (stream: typeof streams[0]) => {
    try {
      for await (const chunk of stream.iterator) {
        chunkQueue.push(chunk);
        resolveWait?.();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      chunkQueue.push({
        type: 'error',
        content: message,
        model: stream.model,
        provider: stream.provider,
      });
      resolveWait?.();
    } finally {
      clearTimeout(stream.timeoutId);
      activeStreams--;
      resolveWait?.();
    }
  };

  // 全ストリームを並列に消費開始
  streams.forEach(s => consumeStream(s));

  // キューからチャンクを順次yield
  while (activeStreams > 0 || chunkQueue.length > 0) {
    if (chunkQueue.length > 0) {
      yield chunkQueue.shift()!;
    } else {
      await new Promise<void>(resolve => {
        resolveWait = resolve;
      });
    }
  }
}
```

---

## 4. ストリーミング処理: SSE設計

### 4.1 SSEプロトコル

クライアントへのレスポンスはServer-Sent Events (SSE)形式で配信する。各LLMのレスポンスは`event`フィールドでモデルを識別する。

#### SSEイベント形式

```
event: chunk
data: {"model":"gpt-4o","provider":"openai","type":"text","content":"Hello"}

event: chunk
data: {"model":"claude-sonnet-4-5-20250929","provider":"anthropic","type":"text","content":"Hi"}

event: chunk
data: {"model":"gpt-4o","provider":"openai","type":"done","content":""}

event: error
data: {"model":"gemini-2.0-flash","provider":"google","type":"error","content":"Rate limit exceeded"}

event: chunk
data: {"model":"claude-sonnet-4-5-20250929","provider":"anthropic","type":"done","content":""}

event: done
data: {}
```

- `event: chunk` — 個々のモデルからのテキストチャンクまたは完了通知
- `event: error` — 個々のモデルのエラー
- `event: done` — 全モデルの処理完了

### 4.2 SSEエンコーダー

```typescript
// src/lib/streaming/sse-encoder.ts

import type { StreamChunk } from '@/types/provider';

export function encodeSSE(eventType: string, data: unknown): string {
  const json = JSON.stringify(data);
  return `event: ${eventType}\ndata: ${json}\n\n`;
}

export function createSSEStream(
  source: AsyncIterable<StreamChunk>
): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        for await (const chunk of source) {
          const eventType = chunk.type === 'error' ? 'error' : 'chunk';
          const sseData = encodeSSE(eventType, chunk);
          controller.enqueue(encoder.encode(sseData));
        }

        // 全ストリーム完了
        controller.enqueue(
          encoder.encode(encodeSSE('done', {}))
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal error';
        controller.enqueue(
          encoder.encode(encodeSSE('error', { type: 'error', content: message }))
        );
      } finally {
        controller.close();
      }
    },
  });
}
```

### 4.3 Route Handler実装

```typescript
// src/app/api/chat/route.ts

import { NextRequest } from 'next/server';
import { executeParallel } from '@/lib/streaming/multi-stream';
import { createSSEStream } from '@/lib/streaming/sse-encoder';
import { chatRequestSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const maxDuration = 120; // Vercelのタイムアウト（秒）

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // バリデーション（zodスキーマ）
    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { messages, models, temperature, maxTokens, apiKeys } = parsed.data;

    // 各モデルへの並列リクエストを構築
    const requests = models.map(model => ({
      model,
      request: { messages, model, temperature, maxTokens },
      userApiKeys: apiKeys,
    }));

    // 並列ストリーム実行 → SSEストリームに変換
    const parallelStream = executeParallel(requests);
    const sseStream = createSSEStream(parallelStream);

    return new Response(sseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // Nginx等のバッファリング防止
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

## 5. APIエンドポイント設計

### 5.1 エンドポイント一覧

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat` | 複数LLMへの並列チャットリクエスト (SSE) |
| GET | `/api/models` | 利用可能なモデル一覧の取得 |
| POST | `/api/models/validate` | APIキーの有効性検証 |
| POST | `/api/providers/test` | ローカルLLMエンドポイントの接続テスト |
| GET | `/api/providers/local/models` | ローカルLLMの利用可能モデル動的取得 |
| GET | `/api/health` | ヘルスチェック |

### 5.2 `POST /api/chat`

メインのチャットエンドポイント。複数モデルに並列でリクエストし、SSEでストリーミングレスポンスを返す。

**Request Body:**
```typescript
{
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  models: string[];           // 並列に呼び出すモデルID一覧 (1〜4個)
  temperature?: number;       // 0.0〜2.0 (default: 0.7)
  maxTokens?: number;         // 最大トークン数 (default: 4096)
  apiKeys?: {                 // ユーザー提供のAPIキー（省略時は環境変数）
    openai?: string;
    anthropic?: string;
    google?: string;
    mistral?: string;
  };
}
```

**Response:** `text/event-stream` (SSE)

SSEイベント形式は「4.1 SSEプロトコル」を参照。

**バリデーションルール:**
- `messages`: 1件以上必須、各メッセージのcontentは空文字不可
- `models`: 1〜4件のモデルID
- `temperature`: 0.0〜2.0の範囲
- `maxTokens`: 1〜128000の範囲

### 5.3 `GET /api/models`

利用可能なモデル一覧を返す。

**Response:**
```typescript
{
  models: Array<{
    id: string;
    name: string;
    provider: string;
    maxTokens: number;
    supportedFeatures: string[];
  }>;
}
```

### 5.4 `POST /api/models/validate`

指定されたAPIキーが有効かを検証する。

**Request Body:**
```typescript
{
  provider: string;
  apiKey: string;
}
```

**Response:**
```typescript
{
  valid: boolean;
  error?: string;
}
```

### 5.5 `GET /api/health`

サービスのヘルスチェック。

**Response:**
```typescript
{
  status: 'ok';
  timestamp: string;
}
```

---

## 6. APIキー管理

### 6.1 方針

APIキーは以下の2つのソースから解決する。ユーザー提供キーが優先。

1. **ユーザー提供キー**: リクエストボディの`apiKeys`フィールドで送信
2. **環境変数**: サーバー側の`.env`に設定されたデフォルトキー

### 6.2 環境変数

```env
# .env.local

# === 商用API ===
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AI...

# === 無料API ===
GROQ_API_KEY=gsk_...
OPENROUTER_API_KEY=sk-or-...

# === ローカルLLM（APIキー不要） ===
OLLAMA_BASE_URL=http://localhost:11434/v1
LMSTUDIO_BASE_URL=http://localhost:1234/v1
# CUSTOM_LLM_BASE_URL=http://localhost:8080/v1
```

### 6.3 キー解決ロジック

```typescript
// src/lib/api-keys.ts

type ProviderName = 'openai' | 'anthropic' | 'google' | 'groq' | 'openrouter';

const envKeyMap: Record<ProviderName, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_API_KEY',
  groq: 'GROQ_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
};

// APIキー不要なプロバイダー
const keylessProviders = new Set(['ollama', 'lmstudio', 'custom']);

export function resolveApiKey(
  provider: string,
  userApiKeys?: Record<string, string>
): string {
  // 0. ローカルLLM等、APIキー不要のプロバイダー
  if (keylessProviders.has(provider)) {
    return 'not-needed';
  }

  // 1. ユーザー提供キーを優先
  const userKey = userApiKeys?.[provider];
  if (userKey) {
    return userKey;
  }

  // 2. 環境変数にフォールバック
  const envVar = envKeyMap[provider as ProviderName];
  if (envVar) {
    const envKey = process.env[envVar];
    if (envKey) {
      return envKey;
    }
  }

  throw new Error(
    `No API key available for provider "${provider}". ` +
    `Set ${envKeyMap[provider as ProviderName] ?? 'the environment variable'} or provide it in the request.`
  );
}
```

### 6.4 セキュリティ考慮

- ユーザー提供のAPIキーはサーバーに保存しない（リクエストスコープのみ）
- クライアント側ではAPIキーをlocalStorageに暗号化せず保存する（ユーザーの判断に委ねる）
- 環境変数のキーはログに出力しない
- APIキーのバリデーションは形式チェック（プレフィックス等）のみ行い、実際の有効性は`/api/models/validate`で検証

---

## 7. エラーハンドリングとタイムアウト

### 7.1 設計方針

- **独立性**: 1つのLLMの失敗が他のLLMに影響しない
- **透過性**: エラーはSSEイベントとしてクライアントに通知
- **タイムアウト**: 各LLM呼び出しに個別のAbortControllerでタイムアウトを設定

### 7.2 タイムアウト設定

| 項目 | 値 | 備考 |
|------|----|------|
| 個別LLM呼び出し | 60秒 | AbortControllerで制御 |
| Route Handler全体 | 120秒 | Vercel maxDuration |
| クライアントSSE接続 | 無制限 | EventSourceのデフォルト |

### 7.3 エラー分類

```typescript
// src/lib/errors.ts

export class ProviderError extends Error {
  constructor(
    public provider: string,
    public model: string,
    public code: ProviderErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export type ProviderErrorCode =
  | 'AUTH_ERROR'        // APIキー無効
  | 'RATE_LIMIT'        // レート制限
  | 'TIMEOUT'           // タイムアウト
  | 'MODEL_NOT_FOUND'   // モデル不存在
  | 'CONTENT_FILTER'    // コンテンツフィルター
  | 'SERVER_ERROR'      // プロバイダー側サーバーエラー
  | 'UNKNOWN';          // その他
```

### 7.4 エラーハンドリングフロー

```
クライアントリクエスト
  ├── モデルA: ストリーミング成功 → テキストチャンク送信 → done
  ├── モデルB: 30秒後にタイムアウト → errorイベント送信
  └── モデルC: レート制限エラー → errorイベント送信
全モデル完了 → done イベント → 接続クローズ
```

各プロバイダーの `chatStream` 内でtry-catchし、エラーを `StreamChunk` の `type: 'error'` として返す。外側の並列実行エンジンがそれを受け取り、SSEのerrorイベントとしてクライアントに配信する。

---

## 8. レート制限対応

### 8.1 サーバーサイドレート制限

自サービスの過剰利用を防ぐため、シンプルなインメモリレート制限を実装する。

```typescript
// src/lib/rate-limiter.ts

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const limits = new Map<string, RateLimitEntry>();

const WINDOW_MS = 60_000;     // 1分ウィンドウ
const MAX_REQUESTS = 20;      // 1分あたり最大20リクエスト

export function checkRateLimit(clientId: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const entry = limits.get(clientId);

  if (!entry || now > entry.resetAt) {
    limits.set(clientId, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= MAX_REQUESTS) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true };
}
```

**クライアント識別**: IPアドレスベース。`X-Forwarded-For` ヘッダーから取得。

### 8.2 プロバイダーレート制限への対応

各LLMプロバイダーのレート制限に対しては以下の方針で対応する。

| 方針 | 詳細 |
|------|------|
| エラー透過 | 429レスポンスはSSEのerrorイベントとしてクライアントに通知 |
| リトライなし | 初期バージョンでは自動リトライしない（ユーザー操作で再送） |
| レスポンスヘッダー活用 | `Retry-After`, `x-ratelimit-remaining` 等をクライアントに転送 |

将来的にはExponential Backoffによる自動リトライを検討するが、V1ではエラーを透過的に返すシンプルな方式とする。

---

## 9. バリデーション

Zodを使用してリクエストボディのバリデーションを行う。

```typescript
// src/lib/validation.ts

import { z } from 'zod';

export const chatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1).max(100_000),
});

export const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(100),
  models: z.array(z.string()).min(1).max(4),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  maxTokens: z.number().int().min(1).max(128_000).optional().default(4096),
  apiKeys: z.record(z.string(), z.string()).optional(),
});
```

---

## 10. 依存パッケージ

| パッケージ | 用途 |
|-----------|------|
| `openai` | OpenAI API SDK |
| `@anthropic-ai/sdk` | Anthropic API SDK |
| `@google/generative-ai` | Google Gemini API SDK |
| `@mistralai/mistralai` | Mistral API SDK |
| `zod` | リクエストバリデーション |

**SDK利用方針**: 各プロバイダーの公式SDKを使用する。SDKはストリーミングAPIを提供しており、直接HTTPリクエストを構築するよりも安全かつメンテナンスコストが低い。SDKのバージョンはpackage.jsonで固定し、破壊的変更に備える。

---

## 11. シーケンス図

```
Client                 API Route            Provider A     Provider B
  |                       |                     |              |
  |-- POST /api/chat ---->|                     |              |
  |                       |-- chatStream() ---->|              |
  |                       |-- chatStream() ------------------->|
  |                       |                     |              |
  |<-- SSE: chunk(A) -----|<-- text chunk ------|              |
  |<-- SSE: chunk(B) -----|<--------------------- text chunk --|
  |<-- SSE: chunk(A) -----|<-- text chunk ------|              |
  |<-- SSE: chunk(B) -----|<--------------------- text chunk --|
  |                       |                     |              |
  |<-- SSE: chunk(A,done)-|<-- done ------------|              |
  |<-- SSE: chunk(B,done)-|<----------------------- done ------|
  |<-- SSE: done ---------|                     |              |
  |                       |                     |              |
```

---

## 12. 今後の拡張ポイント

- **会話履歴の永続化**: データベース（PostgreSQL/SQLite）による会話保存
- **自動リトライ**: Exponential Backoffによるプロバイダーエラーのリトライ
- **コスト追跡**: トークン使用量の計算と表示
- **WebSocket対応**: 双方向通信が必要になった場合の移行パス
- **キャッシュ**: 同一プロンプトに対するレスポンスキャッシュ
- **認証**: NextAuth.jsによるユーザー認証（マルチテナント対応時）
