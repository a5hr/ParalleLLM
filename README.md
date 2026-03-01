# ParallelLM

複数の LLM を同時に実行し、レスポンスを並べて比較できる Web アプリケーション。

**Live Demo**: https://parallellm-xi.vercel.app

## Features

- **並列実行**: 最大 4 モデルを同時にストリーミング実行し、リアルタイムで比較
- **Cloud プロバイダー**: OpenAI, Anthropic, Google, Groq, OpenRouter に対応
- **ローカル LLM**: Ollama, LM Studio, vLLM, llama.cpp 等の OpenAI 互換サーバーに対応（起動時に自動検出）
- **モデル比較 UI**: コンテキストウィンドウ、最大出力トークン、料金を一覧表示
- **モデル個別設定**: temperature、max tokens をモデルごとに調整可能
- **API キー管理**: ブラウザ内に保存。サーバー側の環境変数でも設定可能
- **ダークモード**: ライト / ダーク / システム連動
- **モデル定義の自動更新**: プロバイダー API から毎日自動取得 → PR 作成

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **State**: Zustand (localStorage 永続化)
- **Streaming**: SSE (Server-Sent Events)
- **LLM SDK**: OpenAI SDK, Anthropic SDK, Google Generative AI SDK
- **Deploy**: Vercel (Hobby)
- **CI/CD**: GitHub Actions

## Getting Started

### 1. インストール

```bash
pnpm install
```

### 2. 環境変数の設定

```bash
cp .env.example .env.local
```

`.env.local` に API キーを設定（使いたいプロバイダーだけでOK）:

```bash
# アナリティクス (必須)
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX

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

# トライアルサーバー (Serverless GPU等)
TRIAL_LLM_BASE_URL=https://your-workspace-name--parallellm-trial-server-vllmserver-chat-completions.modal.run
TRIAL_LLM_API_KEY=my-super-secret-token-1234
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

## Model Definitions

モデル一覧は `data/models.json` を単一のソースとして管理しています。

### 自動更新

```bash
# プロバイダー API から最新情報を取得して data/models.json を更新
pnpm run update-models

# 差分のみ表示（ファイル変更なし）
pnpm run update-models --dry-run

# 詳細ログ付き
pnpm run update-models --verbose
```

### データフロー

```
Provider APIs              data/model-overrides.json
(OpenAI, Anthropic,        ├── include: プロバイダーごとの採用モデル一覧
 Google, Groq,             └── overrides: API で取得できない料金・機能等の補完
 OpenRouter)
       │                            │
       ▼                            ▼
  scripts/update-models.ts ─────→ data/models.json
                                       │
                         ┌─────────────┼─────────────┐
                         ▼             ▼             ▼
                   models.ts    providers/     providers/*.ts
                  (defaultModels) (modelProviderMap)  (listModels)
```

### CI での自動更新

GitHub Actions が毎日（JST 08:00）`update-models` を実行し、差分があれば PR を自動作成します。
PR には以下のレビューレポートが自動的に含まれます:

- **新モデル検出**: API に存在するが `include` に未登録のモデル
- **廃止候補**: `include` にあるが API で見つからないモデル
- **料金・トークン上限の変更**: 前回との差分

## Deployment

Vercel (Hobby プラン) にデプロイしています。

### 手動デプロイ

```bash
npx vercel deploy --prod
```

### 自動デプロイ

Vercel に GitHub リポジトリを連携すると、`main` ブランチへの push で自動デプロイされます。

### トライアルサーバー (Modal / Serverless GPU) のデプロイ

本番環境向けに、OSS LLM をセキュアかつ格安（Scale-to-Zero）で提供できるトライアル用のバックエンドスクリプトを用意しています。`scripts/modal/vllm_server.py` を使用します。

1. [Modal](https://modal.com/) アカウントを作成し、CLI ツールでログイン。
   ```bash
   pip install modal
   modal setup
   ```
2. エンドポイントを保護するシークレットキーを作成（任意のパスワードを指定）。
   ```bash
   modal secret create custom-llm-auth-secret TRIAL_LLM_API_KEY=my-super-secret-token-1234
   ```
3. スクリプトをデプロイ。
   ```bash
   modal deploy scripts/modal/vllm_server.py
   ```
4. ターミナルに出力された Web Endpoint URL を Vercel の `TRIAL_LLM_BASE_URL` に設定し、手順2で決めたパスワードを `TRIAL_LLM_API_KEY` に設定します。

### 環境変数 (Vercel)

Vercel ダッシュボードの Settings > Environment Variables で設定:

| 変数名 | 必須 | 備考 |
|--------|------|------|
| `NEXT_PUBLIC_GA_ID` | Yes | Google Analytics Measurement ID (UIの描画等に関わるため必須) |
| `OPENAI_API_KEY` | 任意 | ユーザーがアプリ内で入力も可 |
| `ANTHROPIC_API_KEY` | 任意 | 同上 |
| `GOOGLE_API_KEY` | 任意 | 同上 |
| `GROQ_API_KEY` | 任意 | 同上 |
| `OPENROUTER_API_KEY` | 任意 | 同上 |

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
│   ├── models.ts           # モデル定義 (data/models.json から読込)
│   ├── rate-limiter.ts     # レートリミッター
│   ├── url-validation.ts   # SSRF 対策 URL バリデーション
│   └── validation.ts       # Zod リクエストバリデーション
├── store/
│   ├── api-key-store.ts    # API キー (Zustand + localStorage)
│   ├── chat-store.ts       # チャット状態
│   ├── model-store.ts      # モデル設定
│   └── ui-store.ts         # UI 状態
└── types/                  # TypeScript 型定義

data/
├── models.json             # モデル定義 (単一ソース・自動生成)
└── model-overrides.json    # 手動オーバーライド (料金・名前等)

scripts/
└── update-models.ts        # モデル定義更新バッチ
```

## Security

- **SSRF 対策**: ローカル LLM の `baseUrl` はサーバー側でバリデーション。localhost / プライベート IP / `.local` ドメインのみ許可
- **API キー**: ブラウザの localStorage に保存。サーバーへはリクエスト時のみ送信、ログ記録なし
- **レートリミッター**: IP ベース 20 req/min
- **入力バリデーション**: Zod によるリクエストスキーマ検証
