# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 言語

ユーザーとのやり取りは**常に日本語**で行う。コミットメッセージやコード内コメントは英語。

## Tech Stack

Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui + Zustand

## コマンド

```bash
pnpm dev              # 開発サーバー起動 (http://localhost:3000)
pnpm build            # プロダクションビルド
pnpm lint             # ESLint (--max-warnings 0, 警告もエラー扱い)
pnpm typecheck        # tsc --noEmit
pnpm test             # Vitest watchモード
pnpm test:ci          # Vitest 1回実行 (CI用)
pnpm test -- src/lib/api-keys.test.ts   # 単一テストファイル実行
pnpm update-models    # プロバイダーAPIからモデル定義を更新
```

## コミット・push前の必須チェック

コードを変更したら、コミット前に**全て**ローカルで通すこと:

1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test:ci`
4. `pnpm build`

push前に `git status` でテストが依存するソースファイルが全てコミット済みか確認する。push後は `gh run watch` でCI greenを確認し、失敗時は `gh run view --log-failed` でログを確認して修正する。

**注**: Husky + lint-staged によりコミット時に変更ファイルへの lint が自動実行される。

## アーキテクチャ

### リクエストフロー (SSEストリーミング)

```
ブラウザ                          サーバー (Next.js API Route)
  │                                    │
  │  POST /api/chat (JSON)             │
  │ ──────────────────────────────────>│
  │                                    │── Zodバリデーション (validation.ts)
  │                                    │── レートリミット (rate-limiter.ts)
  │                                    │── maxTokens をモデルのmaxOutputにキャップ
  │                                    │
  │  SSE stream (text/event-stream)    │── executeParallel() (multi-stream.ts)
  │ <──────────────────────────────────│    ├─ キャッシュ確認 (response-cache.ts)
  │    event: chunk / error / done     │    ├─ getProviderForModel() → プロバイダー解決
  │                                    │    ├─ resolveApiKey() → キープール解決
  │                                    │    └─ 各プロバイダーのchatStream()を並列実行
  │                                    │
  use-stream-chat.ts (SSEパース)       │
  └─→ chat-store (Zustand状態更新)     │
```

### プロバイダーシステム

`LLMProvider` インターフェース (`types/provider.ts`) を各プロバイダーが実装:
- **SDK直接利用**: `openai.ts` (OpenAI SDK), `anthropic.ts` (Anthropic SDK), `google.ts` (Google AI SDK)
- **OpenAI互換ファクトリ**: `openai-compatible.ts` → `groq.ts`, `openrouter.ts`, `ollama.ts`, `custom-endpoint.ts` が利用
- **ルーティング**: `providers/index.ts` がモデルIDからプロバイダーを解決。`ollama/`・`custom/` プレフィックスはローカルプロバイダーへ、それ以外は `data/models.json` のマッピングで解決

### APIキー解決 (`api-keys.ts`)

ユーザーキー (ブラウザから送信) > サーバーキー (環境変数) の優先順。環境変数はカンマ区切りで複数キーをプール可能 (`GROQ_API_KEY=key1,key2,key3`)。429エラー時は `markRateLimited()` で次キーへラウンドロビン。

### モデル定義

`data/models.json` が単一ソース。`scripts/update-models.ts` がプロバイダーAPIから取得し、`data/model-overrides.json` のルール (採用モデル一覧・料金上書き・手動エントリ) とマージして生成。GitHub Actionsで週次自動更新。

### Zustandストア (状態管理)

- `chat-store`: ストリーミング状態 (非永続化)。`startStream` → `appendContent` → `completeResponse`/`setError` のライフサイクル
- `model-store`: モデル設定 (localStorage永続化, version 5, マイグレーション付き)。モデル追加/削除時はマイグレーションのバージョンアップが必要
- `api-key-store`: APIキー (localStorage永続化)
- `ui-store`: テーマ等 (localStorage永続化)

### テスト

Vitest (`vitest.config.mts`)。テストファイルはソースと同階層に `*.test.ts` で配置。`@/*` パスエイリアス対応済み。外部APIは `vi.mock()` でモジュールモック、時間依存テストは `vi.useFakeTimers()`、モジュール状態リセットは `vi.resetModules()` + 動的 `import()` パターン。

### セキュリティ

- **SSRF防止** (`url-validation.ts`): ローカルLLMの `baseUrl` をサーバー側で検証。localhost/プライベートIP/.localドメインのみ許可、クラウドメタデータエンドポイントをブロック
- **入力バリデーション** (`validation.ts`): Zodスキーマ。models配列は最大10、content最大100,000文字
- **レートリミット** (`rate-limiter.ts`): IPベース、20 req/60秒のスライディングウィンドウ

## パスエイリアス

`@/*` → `src/*` (tsconfig.json, vitest.config.mts 両方で設定済み)

## lint注意点

- `--max-warnings 0`: 警告もCIで失敗する
- `react-hooks/set-state-in-effect`: useEffect内で直接setStateを呼ぶとエラー。`useSyncExternalStore` や前回値比較パターンを使う
- 未使用変数: destructuringの `_` は `_discarded` + `void _discarded` パターンで回避
