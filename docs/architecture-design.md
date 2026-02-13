# ParallelLM - 全体アーキテクチャ設計ドキュメント

## 1. システムアーキテクチャ概要

ParallelLMは、複数のLLM（Large Language Model）に同一プロンプトを並列送信し、レスポンスをリアルタイムで比較できるWebアプリケーションである。

### アーキテクチャ図

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                         │
│                                                                 │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │
│  │  Prompt Input  │  │  Model Select │  │  Settings     │       │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘       │
│          │                  │                   │               │
│          └──────────┬───────┘───────────────────┘               │
│                     ▼                                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Response Comparison Panel                   │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐   │    │
│  │  │ Model A │  │ Model B │  │ Model C │  │ Model D │   │    │
│  │  │(stream) │  │(stream) │  │(stream) │  │(stream) │   │    │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                     │  Zustand (State Management)               │
└─────────────────────┼───────────────────────────────────────────┘
                      │ HTTP / Server-Sent Events (SSE)
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Next.js Server (API Routes)                   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Route Handlers (/api/chat)                  │    │
│  │                                                         │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │    │
│  │  │ Request  │  │ Provider │  │ Response  │              │    │
│  │  │Validator │─▶│ Router   │─▶│ Streamer  │              │    │
│  │  └──────────┘  └──────────┘  └──────────┘              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              LLM Provider Adapters                       │    │
│  │                                                         │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │    │
│  │  │ OpenAI   │  │Anthropic │  │ Google   │              │    │
│  │  │ Adapter  │  │ Adapter  │  │ Adapter  │              │    │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘              │    │
│  └───────┼──────────────┼──────────────┼────────────────────┘    │
│          │              │              │   API Keys (env vars)   │
└──────────┼──────────────┼──────────────┼────────────────────────┘
           │              │              │
           ▼              ▼              ▼
    ┌────────────┐ ┌────────────┐ ┌────────────┐
    │  OpenAI    │ │ Anthropic  │ │  Google    │
    │  API       │ │ API        │ │ Gemini API │
    └────────────┘ └────────────┘ └────────────┘
```

### データフロー

1. ユーザーがプロンプトを入力し、比較対象のモデルを選択
2. クライアントが `/api/chat` エンドポイントにリクエスト送信（選択モデルごとに並列）
3. API Route が各LLMプロバイダーのAdapterを通じてAPIコール
4. SSE（Server-Sent Events）でストリーミングレスポンスをクライアントに返却
5. クライアントがリアルタイムで各モデルのレスポンスを並列表示

---

## 2. 技術スタック選定と根拠

### フロントエンド

| 技術 | バージョン | 選定理由 |
|------|-----------|---------|
| **Next.js** | 15.x (App Router) | SSR/SSGサポート、API Routes統合、App Routerによるレイアウト管理。フロントとバックエンドを単一プロジェクトで管理可能。 |
| **React** | 19.x | Concurrent Features（Suspense、Transitions）によるストリーミングUIの最適化。並列レスポンス表示との親和性が高い。 |
| **TypeScript** | 5.x | 型安全性による開発効率向上。複数LLMプロバイダーの型定義を統一的に管理。 |
| **Tailwind CSS** | 4.x | ユーティリティファーストでレスポンシブUIを高速構築。カスタムデザインシステムとの統合が容易。 |
| **shadcn/ui** | latest | Radix UIベースのアクセシブルなコンポーネント群。コピー&ペースト方式でフルカスタマイズ可能。ロックインなし。 |

### バックエンド

| 技術 | 選定理由 |
|------|---------|
| **Next.js API Routes (Route Handlers)** | フロントエンドと同一プロジェクトでAPIを実装。Edge Runtimeでのストリーミングサポート。デプロイの簡素化（Vercel等）。 |

### 状態管理

| 技術 | 選定理由 |
|------|---------|
| **Zustand** | 軽量（~1KB）、ボイラープレートが少ない。複数モデルの並列ストリーミング状態を効率的に管理。React外からも状態アクセス可能で、SSEハンドラーとの連携が容易。 |

### LLM SDK

| SDK | 対象プロバイダー | 選定理由 |
|-----|-----------------|---------|
| **openai** | OpenAI | 公式SDK。ストリーミング対応。型定義完備。 |
| **@anthropic-ai/sdk** | Anthropic | 公式SDK。Messages APIのストリーミング対応。 |
| **@google/generative-ai** | Google | 公式SDK。Gemini APIのストリーミング対応。 |

### パッケージマネージャー

| 技術 | 選定理由 |
|------|---------|
| **pnpm** | ディスク効率の高いnode_modules管理（ハードリンク活用）。厳密な依存関係解決でファントム依存を防止。monorepo対応（将来の拡張に備える）。 |

### 開発ツール

| 技術 | 用途 |
|------|------|
| **ESLint** | コード品質チェック |
| **Prettier** | コードフォーマット |
| **Vitest** | ユニットテスト |
| **Playwright** | E2Eテスト |

---

## 3. プロジェクトディレクトリ構成

```
parallellm/
├── docs/                          # ドキュメント
│   └── architecture-design.md     # 本ドキュメント
├── public/                        # 静的ファイル
│   └── favicon.ico
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── layout.tsx             # ルートレイアウト
│   │   ├── page.tsx               # メインページ（プロンプト入力 + 比較画面）
│   │   ├── globals.css            # グローバルスタイル
│   │   ├── api/                   # API Routes
│   │   │   └── chat/
│   │   │       └── route.ts       # チャットAPI（ストリーミング対応）
│   │   └── settings/
│   │       └── page.tsx           # 設定画面（APIキー管理等）
│   │
│   ├── components/                # UIコンポーネント
│   │   ├── ui/                    # shadcn/ui ベースコンポーネント
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── textarea.tsx
│   │   │   └── badge.tsx
│   │   ├── prompt/                # プロンプト関連
│   │   │   ├── prompt-input.tsx   # プロンプト入力フォーム
│   │   │   └── model-selector.tsx # モデル選択UI
│   │   ├── response/              # レスポンス表示関連
│   │   │   ├── response-panel.tsx # 全体比較パネル
│   │   │   ├── response-card.tsx  # 個別モデルレスポンスカード
│   │   │   └── streaming-text.tsx # ストリーミングテキスト表示
│   │   ├── settings/              # 設定関連
│   │   │   └── api-key-form.tsx   # APIキー設定フォーム
│   │   └── layout/                # レイアウト
│   │       ├── header.tsx         # ヘッダー
│   │       └── sidebar.tsx        # サイドバー（履歴等）
│   │
│   ├── lib/                       # ライブラリ・ユーティリティ
│   │   ├── llm/                   # LLMプロバイダー関連
│   │   │   ├── types.ts           # 共通型定義（Provider, Model, Message等）
│   │   │   ├── registry.ts        # プロバイダー/モデルのレジストリ
│   │   │   ├── base-adapter.ts    # 基底アダプタークラス
│   │   │   ├── openai-adapter.ts  # OpenAI アダプター
│   │   │   ├── anthropic-adapter.ts # Anthropic アダプター
│   │   │   ├── google-adapter.ts  # Google アダプター
│   │   │   ├── openai-compatible-adapter.ts # OpenAI互換アダプター（共通基盤）
│   │   │   ├── groq-adapter.ts    # Groq アダプター（OpenAI互換）
│   │   │   ├── openrouter-adapter.ts # OpenRouter アダプター（OpenAI互換）
│   │   │   └── ollama-adapter.ts  # Ollama アダプター（OpenAI互換、動的モデル取得）
│   │   ├── stream/                # ストリーミング関連
│   │   │   └── sse.ts             # SSEユーティリティ
│   │   ├── validation/            # バリデーション
│   │   │   └── schema.ts          # リクエストスキーマ（zod）
│   │   └── utils.ts               # 汎用ユーティリティ
│   │
│   ├── store/                      # Zustand ストア
│   │   ├── chat-store.ts          # チャット状態管理
│   │   ├── model-store.ts         # モデル選択状態管理
│   │   └── settings-store.ts      # 設定状態管理
│   │
│   ├── hooks/                     # カスタムフック
│   │   ├── use-chat-stream.ts     # ストリーミングチャットフック
│   │   └── use-model-selection.ts # モデル選択フック
│   │
│   └── types/                     # グローバル型定義
│       └── index.ts               # 共通型
│
├── .env.local                     # 環境変数（ローカル、git管理外）
├── .env.example                   # 環境変数テンプレート
├── .gitignore
├── .eslintrc.json
├── .prettierrc
├── next.config.ts                 # Next.js設定
├── tailwind.config.ts             # Tailwind CSS設定
├── tsconfig.json                  # TypeScript設定
├── package.json
├── pnpm-lock.yaml
└── vitest.config.ts               # Vitest設定
```

---

## 4. 対応LLMプロバイダー一覧

### Phase 1（初期リリース）

#### 商用API

| プロバイダー | モデル | モデルID | 特徴 |
|-------------|--------|---------|------|
| **OpenAI** | GPT-4o | `gpt-4o` | 高性能マルチモーダル |
| **OpenAI** | GPT-4o mini | `gpt-4o-mini` | 軽量・高速・低コスト |
| **Anthropic** | Claude Sonnet 4.5 | `claude-sonnet-4-5-20250929` | 高性能・バランス型 |
| **Anthropic** | Claude Haiku 4.5 | `claude-haiku-4-5-20251001` | 軽量・高速・低コスト |
| **Google** | Gemini 2.0 Flash | `gemini-2.0-flash` | 高速レスポンス |
| **Google** | Gemini 2.0 Pro | `gemini-2.0-pro` | 高性能 |

#### 無料LLM

| プロバイダー | モデル例 | 特徴 | 無料枠 |
|-------------|---------|------|--------|
| **Google Gemini** | Gemini 2.0 Flash | APIキー取得のみで利用可能 | 15 RPM / 1,500 RPD |
| **Groq** | Llama 3.3 70B, Mixtral 8x7B, Gemma 2 9B | 超高速推論（LPU） | 30 RPM / 14,400 RPD |
| **OpenRouter** | Llama 3.3 8B, Mistral 7B, Phi-3等 | 無料モデル多数、統一API | モデルによる |

#### ローカルLLM

| プロバイダー | 接続方式 | 特徴 |
|-------------|---------|------|
| **Ollama** | OpenAI互換API (`http://localhost:11434/v1`) | 最も普及。ワンコマンドでモデルDL&起動 |
| **LM Studio** | OpenAI互換API (`http://localhost:1234/v1`) | GUIでモデル管理。OpenAI互換サーバー内蔵 |
| **カスタムエンドポイント** | OpenAI互換API (ユーザー指定URL) | llama.cpp, vLLM, text-generation-webui等をカバー |

> **設計方針**: ローカルLLMはOpenAI互換APIを標準とする。Ollama, LM Studio, vLLM等の主要ツールはすべてOpenAI互換エンドポイントを提供しているため、`openai` SDKの `baseURL` パラメータを変更するだけで接続可能。専用SDKは不要。

### Phase 2（将来対応）

| プロバイダー | モデル | 優先度 |
|-------------|--------|--------|
| **Mistral** | Mistral Large, Mistral Small | 中 |
| **Cohere** | Command R+, Command R | 中 |
| **HuggingFace Inference API** | 各種オープンモデル（無料枠あり） | 中 |
| **Amazon Bedrock** | 各種モデル | 低 |
| **Azure OpenAI** | OpenAIモデル（Azure経由） | 低 |

### プロバイダー共通インターフェース

```typescript
// src/lib/llm/types.ts

export interface LLMProvider {
  id: string;                    // "openai" | "anthropic" | "google" | "groq" | "openrouter" | "ollama" | "custom"
  name: string;                  // 表示名
  type: ProviderType;            // プロバイダー種別
  models: LLMModel[];           // 対応モデル一覧
  requiresApiKey: boolean;       // APIキーが必要か（ローカルLLMはfalse）
  baseUrl?: string;              // カスタムベースURL（ローカルLLM用）
}

export type ProviderType = 'cloud' | 'free' | 'local';

export interface LLMModel {
  id: string;                    // APIモデルID
  name: string;                  // 表示名
  providerId: string;            // プロバイダーID
  maxTokens: number;             // 最大トークン数
  supportsStreaming: boolean;    // ストリーミング対応
  supportsImages: boolean;       // 画像入力対応
  isFree: boolean;               // 無料利用可能か
}

export interface ChatRequest {
  messages: ChatMessage[];       // メッセージ履歴
  model: string;                 // モデルID
  provider: string;              // プロバイダーID
  temperature?: number;          // 温度パラメータ
  maxTokens?: number;            // 最大出力トークン
  systemPrompt?: string;         // システムプロンプト
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface StreamChunk {
  type: "text" | "error" | "done";
  content: string;
  model: string;
  provider: string;
  metadata?: {
    tokensUsed?: number;
    latencyMs?: number;
  };
}
```

### アダプターパターン

```typescript
// src/lib/llm/base-adapter.ts

export interface LLMAdapter {
  readonly providerId: string;
  readonly providerName: string;
  readonly providerType: ProviderType;
  readonly requiresApiKey: boolean;

  chat(request: ChatRequest): Promise<ReadableStream<StreamChunk>>;
  listModels(): Promise<LLMModel[]>;
  validateApiKey(apiKey: string): Promise<boolean>;
}
```

各プロバイダーは `LLMAdapter` インターフェースを実装する関数オブジェクトとして定義する。ファクトリ関数（例: `createOpenAICompatibleProvider()`）で生成し、レジストリに登録するだけで新規プロバイダーを追加可能。

### OpenAI互換アダプター（ローカルLLM・Groq・OpenRouter共通）

ローカルLLM（Ollama, LM Studio）、Groq、OpenRouterはすべてOpenAI互換APIを提供しているため、`openai` SDKの `baseURL` を差し替えるだけで接続できる。専用の `OpenAICompatibleAdapter` を用意し、各プロバイダーはこれを設定違いで再利用する。

```typescript
// src/lib/llm/openai-compatible-adapter.ts

export class OpenAICompatibleAdapter extends BaseLLMAdapter {
  constructor(
    readonly providerId: string,
    readonly providerName: string,
    private config: {
      baseUrl: string;
      requiresApiKey: boolean;
      defaultModels: LLMModel[];
      supportsModelDiscovery: boolean; // Ollama等はGET /v1/modelsで動的取得可能
    }
  ) { super(); }

  async chat(request: ChatRequest): Promise<ReadableStream<StreamChunk>> {
    const client = new OpenAI({
      apiKey: request.apiKey || 'not-needed',
      baseURL: this.config.baseUrl,
    });
    // ... OpenAI互換のストリーミング処理
  }

  async listModels(): Promise<LLMModel[]> {
    if (this.config.supportsModelDiscovery) {
      // GET /v1/models で動的にモデル一覧を取得
    }
    return this.config.defaultModels;
  }
}

// 各プロバイダーのインスタンス生成
export const ollamaAdapter = new OpenAICompatibleAdapter('ollama', 'Ollama', {
  baseUrl: 'http://localhost:11434/v1',
  requiresApiKey: false,
  defaultModels: [], // 動的取得
  supportsModelDiscovery: true,
});

export const groqAdapter = new OpenAICompatibleAdapter('groq', 'Groq', {
  baseUrl: 'https://api.groq.com/openai/v1',
  requiresApiKey: true,
  defaultModels: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', isFree: true, ... },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', isFree: true, ... },
    { id: 'gemma2-9b-it', name: 'Gemma 2 9B', isFree: true, ... },
  ],
  supportsModelDiscovery: false,
});

export const openrouterAdapter = new OpenAICompatibleAdapter('openrouter', 'OpenRouter', {
  baseUrl: 'https://openrouter.ai/api/v1',
  requiresApiKey: true,
  defaultModels: [
    { id: 'meta-llama/llama-3.3-8b-instruct:free', name: 'Llama 3.3 8B (Free)', isFree: true, ... },
    { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B (Free)', isFree: true, ... },
  ],
  supportsModelDiscovery: false,
});
```

---

## 5. セキュリティ考慮事項

### APIキー管理

```
重要: APIキーは絶対にクライアントサイドに露出させない
```

| 項目 | 対策 |
|------|------|
| **保存場所** | サーバーサイドの環境変数（`.env.local`）のみ。クライアントバンドルに含まれる `NEXT_PUBLIC_` プレフィックスは使用しない。 |
| **転送** | APIキーはクライアント-サーバー間で転送しない。LLM APIへの通信はすべてサーバーサイドのRoute Handlerから実行。 |
| **Git管理** | `.env.local` は `.gitignore` に含める。`.env.example` にはキーのテンプレートのみ記載。 |
| **本番環境** | Vercel等のホスティングプラットフォームの環境変数機能を利用。 |

### 入力バリデーション

| 項目 | 対策 |
|------|------|
| **リクエストスキーマ** | zodによる厳密なスキーマバリデーション。不正なモデルID、プロバイダーIDの拒否。 |
| **プロンプト長制限** | 最大入力文字数を設定（デフォルト: 100,000文字）。 |
| **レート制限** | API Routeにレート制限を実装（1ユーザーあたり毎分N回）。 |
| **サニタイゼーション** | ユーザー入力のHTMLエスケープ（XSS防止）。Reactのデフォルトエスケープに加え、Markdown表示時にも注意。 |

### ローカルLLM接続のセキュリティ

| 項目 | 対策 |
|------|------|
| **接続先制限** | ローカルLLMのベースURLはサーバーサイドで検証。`localhost` / `127.0.0.1` / プライベートIPのみ許可（SSRF防止）。 |
| **APIキー不要** | ローカルLLMはAPIキーなしで接続可能。`requiresApiKey: false` の場合はキー検証をスキップ。 |
| **接続テスト** | 設定画面でローカルLLMへの疎通確認機能を提供。接続不可の場合はUIで明示。 |

### その他

| 項目 | 対策 |
|------|------|
| **CORS** | Next.js API Routeのデフォルト設定（同一オリジンのみ）を利用。 |
| **HTTPS** | 本番環境では必須。Vercel等は自動対応。 |
| **依存関係** | `pnpm audit` による定期的な脆弱性チェック。 |
| **エラーハンドリング** | LLM APIのエラーレスポンスからの情報漏洩防止。クライアントにはサニタイズ済みエラーのみ返却。 |

---

## 6. 開発環境セットアップ手順

### 前提条件

- Node.js 20.x 以上
- pnpm 9.x 以上

### セットアップ

```bash
# 1. リポジトリのクローン
git clone <repository-url>
cd parallellm

# 2. pnpmのインストール（未インストールの場合）
corepack enable
corepack prepare pnpm@latest --activate

# 3. 依存関係のインストール
pnpm install

# 4. 環境変数の設定
cp .env.example .env.local
# .env.local を編集して各APIキーを設定
```

### 環境変数（.env.example）

```bash
# === 商用API ===
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GOOGLE_GENERATIVE_AI_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# === 無料API ===
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENROUTER_API_KEY=sk-or-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# === ローカルLLM ===
OLLAMA_BASE_URL=http://localhost:11434/v1
LMSTUDIO_BASE_URL=http://localhost:1234/v1
# CUSTOM_LLM_BASE_URL=http://localhost:8080/v1

# === App Settings ===
NEXT_PUBLIC_APP_NAME=ParallelLM
```

### 開発サーバー起動

```bash
# 開発サーバー起動（ホットリロード対応）
pnpm dev

# ビルド
pnpm build

# 本番モード起動
pnpm start

# テスト実行
pnpm test

# リント実行
pnpm lint
```

---

## 7. 将来の拡張性

### プロバイダープラグインアーキテクチャ

新規LLMプロバイダーの追加は以下の3ステップで完了する:

1. **Adapterの実装**: `LLMAdapter` インターフェースを満たすオブジェクトをファクトリ関数で生成（OpenAI互換なら `createOpenAICompatibleProvider()` を設定違いで再利用）
2. **レジストリへの登録**: `src/lib/llm/registry.ts` に新規Adapterを登録
3. **環境変数の追加**: `.env.local` にAPIキーを追加

```typescript
// 例: Mistral プロバイダーの追加（OpenAI互換のためファクトリで生成）
// src/lib/llm/mistral-adapter.ts

export const mistralAdapter = createOpenAICompatibleProvider({
  name: 'mistral',
  type: 'cloud',
  baseUrl: 'https://api.mistral.ai/v1',
  requiresApiKey: true,
  defaultModels: [
    { id: 'mistral-large-latest', name: 'Mistral Large', ... },
    { id: 'mistral-small-latest', name: 'Mistral Small', ... },
  ],
  supportsModelDiscovery: false,
});
```

```typescript
// src/lib/llm/registry.ts への登録
import { mistralAdapter } from "./mistral-adapter";

registry.register(mistralAdapter);
```

### 拡張ポイント一覧

| 拡張領域 | 概要 | 優先度 |
|---------|------|--------|
| **新規プロバイダー追加** | Adapterパターンにより最小限のコードで追加可能 | 高 |
| **チャット履歴保存** | LocalStorage or データベース連携（Prisma + PostgreSQL等） | 中 |
| **プロンプトテンプレート** | よく使うプロンプトの保存・共有機能 | 中 |
| **レスポンス評価** | いいね/バッドボタンでモデル品質を記録 | 中 |
| **マルチモーダル対応** | 画像入力への対応（対応モデルのみ） | 中 |
| **コスト見積もり表示** | 各モデルのトークン使用量とコスト概算を表示 | 低 |
| **エクスポート機能** | 比較結果のMarkdown/PDF出力 | 低 |
| **認証機能** | NextAuth.js によるユーザー認証（チーム利用向け） | 低 |
| **APIアクセス** | 外部からの REST API 提供 | 低 |

---

## 付録: 主要な設計判断

### Q: なぜ別バックエンド（Express等）ではなくNext.js API Routesか？

フロントエンドとバックエンドを単一リポジトリ・単一デプロイで管理できるため。ParallelLMの規模ではAPI Routeで十分であり、別サーバーの運用コストを避ける。将来的にスケーリングが必要になった場合でも、API部分の分離は容易。

### Q: なぜReduxではなくZustandか？

ParallelLMの状態管理はグローバルだが比較的シンプル。Zustandはボイラープレートが少なく、SSEストリームハンドラーからの状態更新が容易（React外からのアクセスが可能）。Reduxの厳格なFluxパターンはこの規模のアプリにはオーバーヘッドが大きい。

### Q: なぜshadcn/uiか？

コンポーネントをプロジェクトにコピーする方式のため、フルカスタマイズが可能。npmパッケージへの依存がなく、バージョンアップで壊れるリスクがない。Radix UIベースでアクセシビリティが担保されている。Tailwind CSSとの統合が前提で、プロジェクトのスタイリング方針と一致する。
