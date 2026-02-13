const en = {
  // Header
  'header.apiKeys': 'API Keys',
  'header.theme': 'Theme',

  // Model selector
  'models.title': 'Models',
  'models.selected': '{count} selected',
  'models.cloud': 'Cloud',
  'models.local': 'Local',
  'models.free': 'FREE',
  'models.freeLower': 'Free',
  'models.contextWindow': 'Context window',
  'models.maxOutput': 'Max output',
  'models.pricingTitle': 'Input / Output per 1M tokens',
  'models.localBadge': 'LOCAL',

  // Model config dialog
  'modelConfig.title': 'Configure model parameters',
  'modelConfig.temperature': 'Temperature',
  'modelConfig.precise': 'Precise (0)',
  'modelConfig.creative': 'Creative (2)',
  'modelConfig.maxTokens': 'Max Tokens',
  'modelConfig.cancel': 'Cancel',
  'modelConfig.save': 'Save',

  // Local models section
  'localModels.models': '{count} models',
  'localModels.offline': 'Offline',
  'localModels.connecting': 'Connecting...',
  'localModels.refresh': 'Refresh',
  'localModels.remove': 'Remove',
  'localModels.connect': 'Connect',
  'localModels.addServer': 'Add server',
  'localModels.helpText': 'Any OpenAI-compatible server works: Ollama, LM Studio, vLLM, llama.cpp, etc.',
  'localModels.autoDetect': ' Well-known ports are auto-detected on startup.',

  // Prompt input
  'prompt.placeholderNoModel': 'Select at least one model above to start...',
  'prompt.placeholder': 'Enter your prompt... (Enter to send, Shift+Enter for newline)',
  'prompt.stop': 'Stop',
  'prompt.send': 'Send',
  'prompt.clear': 'Clear',
  'prompt.stopStreaming': 'Stop streaming',
  'prompt.sendPrompt': 'Send prompt',

  // System prompt
  'systemPrompt.label': 'System Prompt',
  'systemPrompt.placeholder': 'Enter system prompt (optional)...',

  // API key dialog
  'apiKeys.title': 'API Keys',
  'apiKeys.description': 'Enter API keys for each provider. Keys are stored in your browser only.',
  'apiKeys.getKey': 'Get key',
  'apiKeys.paid': 'Paid',
  'apiKeys.free': 'Free',
  'apiKeys.save': 'Save',
  'apiKeys.showKey': 'Show key',
  'apiKeys.hideKey': 'Hide key',
  'apiKeys.helpFree': 'Groq and OpenRouter offer free API access. Sign up and paste your key above.',
  'apiKeys.helpLocal': 'For local models (Ollama, LM Studio), no key is needed — just start the server locally.',
  'apiKeys.helpStorage': 'Keys are stored in your browser only and sent to your own server.',

  // Response
  'response.copy': 'Copy response',
  'response.streaming': 'Streaming...',
  'response.waiting': 'Waiting for response...',
  'response.tokens': '{count} tokens',

  // Connection status
  'connection.connected': 'connected',
  'connection.disconnected': 'disconnected',
  'connection.checking': 'checking',

  // Usage guidance
  'guide.welcome': 'Compare LLM responses side-by-side',
  'guide.step1': '1. Set up API keys (click the key icon above)',
  'guide.step2': '2. Select models to compare',
  'guide.step3': '3. Enter a prompt and hit Send',
  'guide.freeHint': 'Groq and OpenRouter are free — no credit card required.',
  'guide.localHint': 'Running Ollama or LM Studio? Local models are auto-detected.',
  'guide.noModels': 'Select at least one model above to start comparing.',
  'guide.noKeys': 'Set up an API key first to enable cloud models.',

  // Language
  'lang.switch': 'Language',
} as const;

export type TranslationKey = keyof typeof en;
export default en;
