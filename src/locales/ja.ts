import type { TranslationKey } from './en';

const ja: Record<TranslationKey, string> = {
  // Header
  'header.apiKeys': 'API キー',
  'header.theme': 'テーマ',

  // Model selector
  'models.title': 'モデル',
  'models.selected': '{count} 件選択中',
  'models.cloud': 'クラウド',
  'models.local': 'ローカル',
  'models.free': '無料',
  'models.freeLower': '無料',
  'models.contextWindow': 'コンテキスト長',
  'models.maxOutput': '最大出力',
  'models.pricingTitle': '100万トークンあたりの料金（入力/出力）',
  'models.localBadge': 'ローカル',

  // Model config dialog
  'modelConfig.title': 'モデルパラメータの設定',
  'modelConfig.temperature': 'Temperature',
  'modelConfig.precise': '正確 (0)',
  'modelConfig.creative': '創造的 (2)',
  'modelConfig.maxTokens': '最大トークン数',
  'modelConfig.cancel': 'キャンセル',
  'modelConfig.save': '保存',

  // Local models section
  'localModels.models': '{count} モデル',
  'localModels.offline': 'オフライン',
  'localModels.connecting': '接続中...',
  'localModels.refresh': '更新',
  'localModels.remove': '削除',
  'localModels.connect': '接続',
  'localModels.addServer': 'サーバーを追加',
  'localModels.helpText': 'OpenAI 互換サーバーに対応: Ollama, LM Studio, vLLM, llama.cpp 等',
  'localModels.autoDetect': ' Well-known ポートは起動時に自動検出されます。',

  // Prompt input
  'prompt.placeholderNoModel': '上のモデルを1つ以上選択してください...',
  'prompt.placeholder': '質問や指示を入力... (Enter で送信、Shift+Enter で改行)',
  'prompt.stop': '停止',
  'prompt.send': '送信',
  'prompt.clear': 'クリア',
  'prompt.stopStreaming': 'ストリーミングを停止',
  'prompt.sendPrompt': 'プロンプトを送信',

  // System prompt
  'systemPrompt.label': 'システムプロンプト',
  'systemPrompt.placeholder': 'モデルの振る舞いを指定（例: あなたは○○の専門家です / JSON形式で回答してください）',

  // API key dialog
  'apiKeys.title': 'API キー',
  'apiKeys.description': 'クラウドモデルを使うための API キーを入力してください。',
  'apiKeys.trustBadge': 'キーはブラウザ内にのみ保存されます',
  'apiKeys.trustDetail': 'localStorage に保存され、外部サーバーには一切送信されません。各プロバイダーへの API リクエスト時のみ使用されます。',
  'apiKeys.getKey': 'キー取得',
  'apiKeys.getKeyFree': '無料キーを取得',
  'apiKeys.paid': '有料',
  'apiKeys.free': '無料',
  'apiKeys.save': '保存',
  'apiKeys.showKey': 'キーを表示',
  'apiKeys.hideKey': 'キーを隠す',
  'apiKeys.helpFree': 'Groq と OpenRouter は完全無料です。クレジットカード不要 — アカウント登録してキーを貼り付けるだけで使えます。',
  'apiKeys.helpLocal': 'ローカルモデル（Ollama, LM Studio）はキー不要です。サーバーを起動するだけで使えます。',
  'apiKeys.helpDelete': 'キーを削除するには、入力欄を空にして Enter を押してください。キーが外部に送信・公開されることはありません。',

  // Response
  'response.copy': 'レスポンスをコピー',
  'response.streaming': 'ストリーミング中...',
  'response.waiting': 'レスポンスを待機中...',
  'response.tokens': '{count} トークン',
  'response.thinking': '思考中...',
  'response.thinkingChars': '思考過程 ({count}文字)',

  // Connection status
  'connection.connected': '接続済み',
  'connection.disconnected': '未接続',
  'connection.checking': '確認中',

  // Usage guidance
  'guide.welcome': 'LLM のレスポンスを並べて比較',
  'guide.step1': '1. API キーを設定（上の鍵アイコン — キーはブラウザ内にのみ保存）',
  'guide.step2': '2. 比較したいモデルを選択',
  'guide.step3': '3. プロンプトを入力して送信',
  'guide.freeHint': 'Groq と OpenRouter は無料（カード不要、簡単登録）。キーはすべてブラウザ内に保存されます。',
  'guide.localHint': 'Ollama / LM Studio を起動中ならローカルモデルが自動検出されます',
  'guide.noModels': '上のモデルを1つ以上選択すると比較できます。',
  'guide.noKeys': 'クラウドモデルを使うには API キーが必要です（ブラウザ内にのみ保存、外部送信なし）。',

  // Quick start
  'quickstart.title': 'LLM のレスポンスを並べて比較',
  'quickstart.step1': 'API キーを設定（鍵アイコン — ブラウザ内にのみ保存）',
  'quickstart.step2': '比較したいモデルを選択',
  'quickstart.step3': 'プロンプトを入力して送信',
  'quickstart.hint': 'Groq・OpenRouter は無料（カード不要）。Ollama / LM Studio はローカルモデルを自動検出。キーはすべてブラウザ内に保存されます。',
  'quickstart.hintFree': '無料 — カード登録不要',
  'quickstart.hintLocal': 'ローカルモデルを自動検出',
  'quickstart.hintKeys': 'キーはすべてブラウザ内に保存',

  // Language
  'lang.switch': '言語',

  // Model list dialog
  'modelList.title': '登録モデル一覧',
  'modelList.description': '利用可能な全モデルとその仕様',
  'modelList.modelCount': 'モデル',
  'modelList.colName': 'モデル名',
  'modelList.colId': 'ID',
  'modelList.colContext': 'コンテキスト',
  'modelList.colMaxOutput': '最大出力',
  'modelList.colPricing': '料金 (入力/出力)',
  'modelList.viewAll': '全モデルを表示',

  // Trial Models
  'trial.privacyTitle': '',
  'trial.privacyDesc': '入力されたプロンプトやチャット履歴はサーバーに保存されず、AIの学習にも利用されません。',
  'trial.coldStartTitle': '初回起動について: ',
  'trial.coldStartDesc': 'Open Weightsモデルは初回起動時にクラウドGPUを確保・ロードするため、最初の1回目のみ1〜3分ほど時間がかかります。2回目以降は即座に返答されます。',
};

export default ja;
