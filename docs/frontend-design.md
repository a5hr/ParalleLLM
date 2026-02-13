# ParallelLM フロントエンド設計書

## 1. 概要

ParallelLM は、複数の LLM（Large Language Model）に同一プロンプトを並列送信し、レスポンスをリアルタイムでストリーミング表示・比較できる Web アプリケーションである。本ドキュメントでは、フロントエンドの UI/UX アーキテクチャ、技術選定、コンポーネント構成、状態管理方針を定義する。

---

## 2. フレームワーク選定

### 基本スタック

| 技術 | バージョン | 用途 |
|------|-----------|------|
| **React** | 19.x | UI ライブラリ |
| **Next.js** | 15.x (App Router) | フレームワーク |
| **TypeScript** | 5.x | 型安全性 |
| **Tailwind CSS** | 4.x | ユーティリティファーストCSS |
| **shadcn/ui** | latest | UIコンポーネントライブラリ |
| **Zustand** | 5.x | 状態管理 |

### 選定根拠

- **React + Next.js (App Router)**: Server Components による初期ロード最適化、Route Handlers による API プロキシ実装、Streaming SSR との親和性が高い。App Router の `loading.tsx` / `Suspense` でストリーミング UI を自然に扱える。
- **TypeScript**: LLM レスポンスの型定義、API インターフェースの型安全性を確保。複数 LLM のレスポンス形式の違いを型で吸収する。
- **Tailwind CSS + shadcn/ui**: shadcn/ui はコンポーネントをプロジェクトにコピーする方式のため、カスタマイズ性が高い。Tailwind CSS との組み合わせで、一貫したデザインシステムを少ない CSS で実現できる。
- **Zustand**: Redux と比較して boilerplate が少なく、複数 LLM のストリーミング状態を個別に管理するのに適している。ミドルウェア（`immer`, `persist`）で拡張可能。

---

## 3. UI レイアウト設計

### 3.1 全体レイアウト構造

```
+------------------------------------------------------------------+
|  Header (ロゴ, 設定, テーマ切替)                                    |
+------------------------------------------------------------------+
|                                                                    |
|  +------------------------------------------------------------+  |
|  |  Model Selector Bar                                         |  |
|  |  [✓ GPT-4o] [✓ Claude Sonnet] [✓ Gemini Pro] [⚡Llama 70B] [🏠 llama3:8b] [+ Add] |  |
|  +------------------------------------------------------------+  |
|                                                                    |
|  +------------------------------------------------------------+  |
|  |  Prompt Input Area                                          |  |
|  |  +--------------------------------------------------------+|  |
|  |  | テキストエリア (Shift+Enter で改行, Enter で送信)         ||  |
|  |  +--------------------------------------------------------+|  |
|  |  [System Prompt ▼]                    [送信] [停止] [クリア]|  |
|  +------------------------------------------------------------+  |
|                                                                    |
|  +------------------------------------------------------------+  |
|  |  Response Comparison View                                   |  |
|  |  +------------------+ +------------------+ +-------------+  |  |
|  |  | GPT-4o           | | Claude Sonnet    | | Gemini Pro  |  |  |
|  |  | ストリーミング... | | ストリーミング...| | 待機中...   |  |  |
|  |  |                  | |                  | |             |  |  |
|  |  | [レイテンシ]     | | [レイテンシ]     | | [レイテンシ]|  |  |
|  |  | [トークン数]     | | [トークン数]     | | [トークン数]|  |  |
|  |  | [コピー] [評価]  | | [コピー] [評価]  | | [コピー]    |  |  |
|  |  +------------------+ +------------------+ +-------------+  |  |
|  +------------------------------------------------------------+  |
|                                                                    |
+------------------------------------------------------------------+
```

### 3.2 レスポンシブ対応

| ブレイクポイント | レイアウト |
|-----------------|-----------|
| `>= 1280px` (xl) | 横並び 3〜4 カラム |
| `>= 768px` (md) | 横並び 2 カラム |
| `< 768px` (sm) | タブ切替式（1カラム + タブナビゲーション） |

モバイルではタブ切替式にすることで、各 LLM のレスポンスを全幅で表示し可読性を確保する。

### 3.3 比較ビューのモード

1. **並列表示モード（デフォルト）**: 全 LLM のレスポンスを横並びで同時表示
2. **差分表示モード**: 2 つの LLM レスポンスを選択し、diff 形式で比較表示
3. **フォーカスモード**: 1 つの LLM レスポンスを全幅で詳細表示

---

## 4. リアルタイムストリーミング表示

### 4.1 アーキテクチャ

```
Browser                          Next.js Server              LLM APIs
  |                                   |                         |
  |  POST /api/chat            |                         |
  |  { prompt, models[] }             |                         |
  | --------------------------------> |                         |
  |                                   |  並列リクエスト          |
  |                                   | ----------------------> |
  |                                   | ----------------------> |
  |                                   | ----------------------> |
  |                                   |                         |
  |  ReadableStream (NDJSON)          |   SSE / Stream          |
  | <-------------------------------- | <---------------------- |
  |                                   |                         |
  |  各モデルのチャンクを              |                         |
  |  model_id で識別して表示           |                         |
```

### 4.2 ストリーミング方式

**Server-Sent Events (SSE)** を採用する。バックエンド設計のSSEプロトコルに準拠する。

```typescript
// ストリームチャンクの型定義
type StreamChunk =
  | { type: 'start'; modelId: string; timestamp: number }
  | { type: 'delta'; modelId: string; content: string }
  | { type: 'done'; modelId: string; usage: TokenUsage; latencyMs: number }
  | { type: 'error'; modelId: string; error: string };

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}
```

**クライアント側の処理フロー**:

```typescript
// hooks/useStreamChat.ts
async function streamChat(prompt: string, modelIds: string[]) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], models: modelIds }),
    signal: abortController.signal,
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || ''; // 未完成イベントをバッファに残す

    for (const event of events) {
      const dataLine = event.split('\n').find(l => l.startsWith('data: '));
      if (!dataLine) continue;
      const chunk: StreamChunk = JSON.parse(dataLine.slice(6));
      // Zustand store を更新
      updateModelResponse(chunk);
    }
  }
}
```

### 4.3 ストリーミング表示の UX 要件

- 各モデルのレスポンスカードにタイピングアニメーション（カーソル点滅）を表示
- ストリーミング中は自動スクロールし、ユーザーが手動スクロールした場合は自動スクロールを停止
- Markdown レンダリングはストリーミング中もリアルタイムで反映（`react-markdown` + `remark-gfm`）
- コードブロックはストリーミング完了後にシンタックスハイライトを適用（パフォーマンス考慮）
- 各モデルの応答を個別にキャンセル可能

---

## 5. コンポーネント構成

### 5.1 ディレクトリ構造

```
src/
├── app/
│   ├── layout.tsx              # ルートレイアウト
│   ├── page.tsx                # メインページ
│   ├── api/
│   │   └── chat/
│   │       └── route.ts        # チャットAPI（SSEストリーミング）
│   └── settings/
│       └── page.tsx            # 設定ページ
├── components/
│   ├── ui/                     # shadcn/ui コンポーネント
│   ├── header/
│   │   └── Header.tsx
│   ├── model-selector/
│   │   ├── ModelSelector.tsx       # モデル選択バー
│   │   ├── ModelChip.tsx           # 個別モデルチップ
│   │   └── ModelConfigDialog.tsx   # モデルパラメータ設定ダイアログ
│   ├── prompt/
│   │   ├── PromptInput.tsx         # プロンプト入力エリア
│   │   └── SystemPromptEditor.tsx  # システムプロンプト編集
│   ├── response/
│   │   ├── ResponseGrid.tsx        # レスポンス比較グリッド
│   │   ├── ResponseCard.tsx        # 個別モデルレスポンスカード
│   │   ├── ResponseContent.tsx     # Markdown レンダリング
│   │   ├── ResponseMeta.tsx        # メタ情報（レイテンシ, トークン数）
│   │   └── StreamingCursor.tsx     # ストリーミングカーソル
│   ├── comparison/
│   │   ├── DiffView.tsx            # 差分比較ビュー
│   │   └── ViewModeToggle.tsx      # 表示モード切替
│   ├── provider-setup/
│   │   ├── ProviderSetup.tsx       # プロバイダー設定パネル
│   │   ├── LocalLLMConfig.tsx      # ローカルLLM接続設定（URL入力、接続テスト）
│   │   ├── FreeLLMGuide.tsx        # 無料LLM利用ガイド（APIキー取得手順）
│   │   └── ConnectionStatus.tsx    # 接続状態インジケーター
│   └── history/
│       ├── HistoryPanel.tsx        # 履歴サイドパネル
│       └── HistoryItem.tsx         # 履歴アイテム
├── hooks/
│   ├── useStreamChat.ts        # ストリーミングチャット Hook
│   ├── useAutoScroll.ts        # 自動スクロール制御
│   └── useKeyboardShortcuts.ts # キーボードショートカット
├── store/
│   ├── chatStore.ts            # チャット状態管理
│   ├── modelStore.ts           # モデル設定状態管理
│   └── uiStore.ts              # UI 状態管理
├── types/
│   ├── chat.ts                 # チャット関連型定義
│   ├── model.ts                # モデル関連型定義
│   └── stream.ts               # ストリーム関連型定義
└── lib/
    ├── models.ts               # モデル定義・設定
    └── utils.ts                # ユーティリティ
```

### 5.2 主要コンポーネントの責務

| コンポーネント | 責務 |
|---------------|------|
| `Header` | アプリロゴ、設定リンク、ダーク/ライトテーマ切替 |
| `ModelSelector` | 利用可能な LLM 一覧表示、選択/解除、パラメータ設定への導線 |
| `ModelChip` | 個別モデルのトグル表示。選択状態・接続状態のインジケーター。種別バッジ表示（FREE/LOCAL） |
| `ModelConfigDialog` | temperature, max_tokens 等のモデルパラメータ設定 |
| `PromptInput` | テキスト入力、送信ボタン、送信中のキャンセルボタン、キーボードショートカット |
| `SystemPromptEditor` | システムプロンプトの折りたたみ式エディタ |
| `ResponseGrid` | レスポンシブグリッドレイアウト管理、表示モード切替 |
| `ResponseCard` | 1 つの LLM レスポンス表示。ストリーミング状態、完了状態、エラー状態を管理 |
| `ResponseContent` | Markdown → HTML レンダリング。コードブロックのシンタックスハイライト |
| `ResponseMeta` | 応答時間、トークン使用量、コスト概算の表示 |
| `StreamingCursor` | ストリーミング中のカーソル点滅アニメーション |
| `DiffView` | 2 つのレスポンスのテキスト差分表示 |
| `HistoryPanel` | 過去のプロンプト・レスポンス履歴一覧 |

---

## 6. 状態管理

### 6.1 Zustand Store 設計

3 つの Store に分離し、関心を分離する。

#### chatStore: チャット・ストリーミング状態

```typescript
interface ModelResponse {
  modelId: string;
  content: string;
  status: 'idle' | 'streaming' | 'done' | 'error';
  error?: string;
  usage?: TokenUsage;
  latencyMs?: number;
  startedAt?: number;
}

interface ChatState {
  // State
  prompt: string;
  systemPrompt: string;
  responses: Record<string, ModelResponse>; // modelId -> response
  isStreaming: boolean;
  abortController: AbortController | null;

  // Actions
  setPrompt: (prompt: string) => void;
  setSystemPrompt: (systemPrompt: string) => void;
  startStream: (modelIds: string[]) => void;
  updateResponse: (chunk: StreamChunk) => void;
  cancelStream: (modelId?: string) => void; // 個別 or 全体キャンセル
  clearResponses: () => void;
}
```

#### modelStore: モデル設定・選択状態

```typescript
type ProviderType = 'cloud' | 'free' | 'local';

interface ModelConfig {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'google' | 'groq' | 'openrouter' | 'ollama' | 'custom';
  providerType: ProviderType;
  enabled: boolean;
  isFree: boolean;
  parameters: {
    temperature: number;
    maxTokens: number;
    topP: number;
  };
}

interface LocalLLMEndpoint {
  id: string;
  name: string;
  baseUrl: string;
  status: 'connected' | 'disconnected' | 'checking';
  models: string[]; // 動的取得されたモデル一覧
}

interface ModelState {
  models: ModelConfig[];
  selectedModelIds: string[];
  localEndpoints: LocalLLMEndpoint[]; // ローカルLLMエンドポイント一覧

  toggleModel: (modelId: string) => void;
  updateModelConfig: (modelId: string, config: Partial<ModelConfig>) => void;
  addCustomModel: (config: ModelConfig) => void;
  // ローカルLLM管理
  addLocalEndpoint: (endpoint: Omit<LocalLLMEndpoint, 'status' | 'models'>) => void;
  removeLocalEndpoint: (id: string) => void;
  testLocalEndpoint: (id: string) => Promise<boolean>;
  refreshLocalModels: (endpointId: string) => Promise<void>;
}
```

#### uiStore: UI 表示状態

```typescript
interface UIState {
  viewMode: 'parallel' | 'diff' | 'focus';
  focusedModelId: string | null;
  diffModelIds: [string, string] | null;
  isHistoryOpen: boolean;
  theme: 'light' | 'dark' | 'system';

  setViewMode: (mode: UIState['viewMode']) => void;
  setFocusedModel: (modelId: string | null) => void;
  setDiffModels: (ids: [string, string] | null) => void;
  toggleHistory: () => void;
  setTheme: (theme: UIState['theme']) => void;
}
```

### 6.2 Store の永続化

- `modelStore` は `zustand/middleware` の `persist` で `localStorage` に永続化（モデル選択・パラメータ設定を保持）
- `uiStore` の `theme` も `persist` で永続化
- `chatStore` は永続化しない（セッション内のみ）

---

## 7. スタイリング方針

### 7.1 Tailwind CSS 設計指針

- **ユーティリティファースト**: カスタム CSS は原則書かない。Tailwind のユーティリティクラスで完結させる。
- **デザイントークン**: `tailwind.config.ts` でカラーパレット、スペーシング、フォントを一元定義。
- **ダークモード**: `class` ストラテジーで `dark:` プレフィックスによるダークモード対応。

### 7.2 shadcn/ui 採用コンポーネント

| shadcn/ui コンポーネント | 用途 |
|-------------------------|------|
| `Button` | 送信、キャンセル、各種アクション |
| `Textarea` | プロンプト入力 |
| `Dialog` | モデル設定ダイアログ |
| `Tabs` | モバイル時のレスポンスタブ切替 |
| `Badge` | モデル選択チップ |
| `Card` | レスポンスカード |
| `Tooltip` | メタ情報のホバー表示 |
| `Sheet` | 履歴サイドパネル |
| `Slider` | temperature 等のパラメータ調整 |
| `DropdownMenu` | コンテキストメニュー |
| `Toggle` | 表示モード切替 |
| `ScrollArea` | レスポンスエリアのスクロール |
| `Skeleton` | ローディング表示 |
| `Separator` | セクション区切り |

### 7.3 カラーパレット

shadcn/ui のデフォルト CSS 変数ベースのカラーシステムを採用し、ライト/ダーク双方に対応する。各 LLM プロバイダーに固有のアクセントカラーを割り当て、視覚的に識別しやすくする。

```typescript
// lib/models.ts
const providerColors = {
  // 商用API
  openai:      { accent: 'emerald',  hex: '#10a37f' },
  anthropic:   { accent: 'orange',   hex: '#d97706' },
  google:      { accent: 'blue',     hex: '#4285f4' },
  // 無料API
  groq:        { accent: 'cyan',     hex: '#06b6d4' },
  openrouter:  { accent: 'violet',   hex: '#7c3aed' },
  // ローカルLLM
  ollama:      { accent: 'slate',    hex: '#64748b' },
  custom:      { accent: 'purple',   hex: '#8b5cf6' },
} as const;

// プロバイダー種別バッジ
const providerTypeBadge = {
  cloud: null,                                    // 商用は表示なし
  free:  { label: 'FREE', color: 'bg-green-100 text-green-800' },
  local: { label: 'LOCAL', color: 'bg-slate-100 text-slate-800' },
} as const;
```

---

## 8. キーボードショートカット

| ショートカット | アクション |
|---------------|-----------|
| `Enter` | プロンプト送信 |
| `Shift + Enter` | プロンプト内改行 |
| `Escape` | ストリーミングキャンセル |
| `Cmd/Ctrl + K` | プロンプト入力にフォーカス |
| `Cmd/Ctrl + 1〜4` | N番目のレスポンスにフォーカス |
| `Cmd/Ctrl + D` | 差分表示モード切替 |

---

## 9. パフォーマンス最適化

### 9.1 レンダリング最適化

- `ResponseCard` を `React.memo` でメモ化し、他モデルのストリーミング更新で不要な再レンダリングを防ぐ
- Markdown レンダリングに `useMemo` を適用
- コードブロックのシンタックスハイライトは `dynamic import` で遅延ロード
- ストリーミング中の Zustand 更新は `requestAnimationFrame` でバッチ化し、60fps を維持

### 9.2 バンドルサイズ最適化

- シンタックスハイライト（`shiki`）は動的インポート
- 使用する言語のみをバンドルに含める
- `next/dynamic` による必要時ロード

---

## 10. エラーハンドリング

| エラーケース | UI 表示 |
|-------------|---------|
| API キー未設定 | 設定ページへの誘導バナー（無料APIの場合は取得ガイドも表示） |
| モデル接続エラー | 該当カードにエラーメッセージ + リトライボタン |
| ローカルLLM接続不可 | 「Ollamaが起動していません」等のガイダンス + 起動手順リンク |
| レート制限 | トースト通知 + 自動リトライ（バックオフ）。無料APIの場合は制限情報も表示 |
| ネットワーク切断 | グローバルバナー + 再接続時自動リトライ |
| ストリーム中断 | 途中までのレスポンスを保持 + 再開ボタン |

---

## 11. 今後の拡張を見据えた設計ポイント

- **会話履歴**: `chatStore` を拡張し、複数ターンの会話をサポート可能な構造
- **テンプレート**: プロンプトテンプレート機能のためのデータ構造を `modelStore` に追加可能
- **エクスポート**: レスポンス比較結果の JSON / Markdown エクスポート
- **評価機能**: レスポンスの星評価・コメント機能のための `ResponseCard` の拡張ポイント
