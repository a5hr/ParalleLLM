# ParallelLM

複数の LLM を同時に実行し、レスポンスを並べて比較できる Web アプリケーション。

## Features

- **並列実行**: 最大 4 モデルを同時にストリーミング実行し、リアルタイムで比較
- **Cloud プロバイダー**: OpenAI, Anthropic, Google, Groq, OpenRouter に対応
- **ローカル LLM**: Ollama, LM Studio, vLLM, llama.cpp 等の OpenAI 互換サーバーに対応（起動時に自動検出）
- **モデル比較 UI**: コンテキストウィンドウ、最大出力トークン、料金を一覧表示
- **モデル個別設定**: temperature、max tokens をモデルごとに調整可能
- **API キー管理**: ブラウザ内に保存。サーバー側の環境変数でも設定可能
- **ダークモード**: ライト / ダーク / システム連動

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **State**: Zustand (localStorage 永続化)
- **Streaming**: SSE (Server-Sent Events)
- **LLM SDK**: OpenAI SDK, Anthropic SDK, Google Generative AI SDK

## Getting Started

### 1. インストール

```bash
pnpm install
```

### 2. 環境変数の設定

`.env.local` に API キーを設定（使いたいプロバイダーだけでOK）:

```bash
# Cloud (有料)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GENERATIVE_AI_API_KEY=...

# Cloud (無料枠)
GROQ_API_KEY=gsk_...
OPENROUTER_API_KEY=sk-or-...

# ローカル LLM (オプション)
OLLAMA_BASE_URL=http://localhost:11434/v1
LMSTUDIO_BASE_URL=http://localhost:1234/v1
```

API キーはアプリ内の設定画面（ヘッダーの鍵アイコン）からも入力できます。

### 3. 起動

```bash
pnpm dev
```

http://localhost:3000 を開く。

## Usage

### Cloud モデル

1. API キーを設定（環境変数 or アプリ内設定）
2. Models セクションで使いたいモデルを選択
3. プロンプトを入力して送信

### ローカル LLM

1. Ollama や LM Studio 等を起動（well-known ポートは自動検出）
2. 任意のサーバーは「Add server」から URL を入力して接続
3. 検出されたモデルを選択して実行

対応するすべての OpenAI 互換サーバー:
- [Ollama](https://ollama.ai) (port 11434)
- [LM Studio](https://lmstudio.ai) (port 1234)
- [vLLM](https://docs.vllm.ai)
- [llama.cpp server](https://github.com/ggerganov/llama.cpp)
- その他 OpenAI 互換 API を提供するサーバー

### 無料で試す

API キー登録は必要ですが、以下のプロバイダーは無料で利用可能:

| Provider | 取得先 | モデル例 |
|----------|--------|----------|
| Groq | https://console.groq.com/keys | Llama 3.3 70B, Llama 4 Maverick |
| OpenRouter | https://openrouter.ai/keys | DeepSeek V3, Mistral Small 3.1 |

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/
│   │   ├── chat/           # POST /api/chat - SSE ストリーミング
│   │   ├── health/         # GET /api/health
│   │   ├── models/         # GET /api/models
│   │   └── providers/      # ローカル LLM 検出・テスト
│   └── page.tsx            # メインページ
├── components/
│   ├── layout/             # Header
│   ├── model-selector/     # モデル選択 UI
│   ├── prompt/             # プロンプト入力
│   ├── response/           # レスポンス表示カード
│   ├── settings/           # API キー設定ダイアログ
│   └── ui/                 # shadcn/ui コンポーネント
├── hooks/
│   └── use-stream-chat.ts  # SSE ストリーミングフック
├── lib/
│   ├── providers/          # LLM プロバイダーアダプター
│   ├── streaming/          # SSE エンコーダー・並列実行エンジン
│   ├── api-keys.ts         # API キー解決
│   ├── models.ts           # モデル定義・料金データ
│   ├── rate-limiter.ts     # レートリミッター
│   ├── url-validation.ts   # SSRF 対策 URL バリデーション
│   └── validation.ts       # Zod リクエストバリデーション
├── store/
│   ├── api-key-store.ts    # API キー (Zustand + localStorage)
│   ├── chat-store.ts       # チャット状態
│   ├── model-store.ts      # モデル設定
│   └── ui-store.ts         # UI 状態
└── types/                  # TypeScript 型定義
```

## Security

- **SSRF 対策**: ローカル LLM の `baseUrl` はサーバー側でバリデーション。localhost / プライベート IP / `.local` ドメインのみ許可
- **API キー**: ブラウザの localStorage に保存。サーバーへはリクエスト時のみ送信、ログ記録なし
- **レートリミッター**: IP ベース 20 req/min
- **入力バリデーション**: Zod によるリクエストスキーマ検証
