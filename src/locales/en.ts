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
  'prompt.placeholder': 'Ask a question or give an instruction... (Enter to send, Shift+Enter for newline)',
  'prompt.stop': 'Stop',
  'prompt.send': 'Send',
  'prompt.clear': 'Clear',
  'prompt.stopStreaming': 'Stop streaming',
  'prompt.sendPrompt': 'Send prompt',

  // System prompt
  'systemPrompt.label': 'System Prompt',
  'systemPrompt.placeholder': 'Set model behavior (e.g., You are an expert in... / Reply in JSON format)',

  // API key dialog
  'apiKeys.title': 'API Keys',
  'apiKeys.description': 'Enter your API keys to use cloud models. Your keys are safe here.',
  'apiKeys.trustBadge': 'Keys are saved in your browser only',
  'apiKeys.trustDetail': 'Stored in localStorage — never sent to external servers. Keys are used only for direct API calls to each provider.',
  'apiKeys.getKey': 'Get key',
  'apiKeys.getKeyFree': 'Get free key',
  'apiKeys.paid': 'Paid',
  'apiKeys.free': 'Free',
  'apiKeys.save': 'Save',
  'apiKeys.showKey': 'Show key',
  'apiKeys.hideKey': 'Hide key',
  'apiKeys.helpFree': 'Groq and OpenRouter are completely free — no credit card needed. Just sign up, copy a key, and paste it above.',
  'apiKeys.helpLocal': 'For local models (Ollama, LM Studio), no key is needed — just start the server locally.',
  'apiKeys.helpDelete': 'To remove a key, clear the field and press Enter. Keys are never transmitted or exposed externally.',

  // Response
  'response.copy': 'Copy response',
  'response.streaming': 'Streaming...',
  'response.waiting': 'Waiting for response...',
  'response.tokens': '{count} tokens',
  'response.thinking': 'Thinking...',
  'response.thinkingChars': 'Thinking ({count} chars)',

  // Connection status
  'connection.connected': 'connected',
  'connection.disconnected': 'disconnected',
  'connection.checking': 'checking',

  // Usage guidance
  'guide.welcome': 'Compare LLM responses side-by-side',
  'guide.step1': '1. Set up API keys (click the key icon above — keys stay in your browser)',
  'guide.step2': '2. Select models to compare',
  'guide.step3': '3. Enter a prompt and hit Send',
  'guide.freeHint': 'Groq and OpenRouter are free — no credit card, just a quick signup. All keys stay in your browser.',
  'guide.localHint': 'Running Ollama or LM Studio? Local models are auto-detected.',
  'guide.noModels': 'Select at least one model above to start comparing.',
  'guide.noKeys': 'To use cloud models, add an API key (stored in your browser only, never shared).',

  // Quick start
  'quickstart.title': 'Compare LLM responses side-by-side',
  'quickstart.step1': 'Set up API keys (key icon — stored in browser only)',
  'quickstart.step2': 'Select models to compare',
  'quickstart.step3': 'Enter a prompt and send',
  'quickstart.hint': 'Groq & OpenRouter are free (no credit card). Local models (Ollama, LM Studio) are auto-detected. All keys stay in your browser.',
  'quickstart.hintFree': 'Free — no credit card needed',
  'quickstart.hintLocal': 'Auto-detected when running locally',
  'quickstart.hintKeys': 'All keys stay in your browser',

  // Language
  'lang.switch': 'Language',

  // Model list dialog
  'modelList.title': 'Registered Models',
  'modelList.description': 'All available models with their specifications',
  'modelList.modelCount': 'models',
  'modelList.colName': 'Model',
  'modelList.colId': 'ID',
  'modelList.colContext': 'Context',
  'modelList.colMaxOutput': 'Max Output',
  'modelList.colPricing': 'Pricing (In/Out)',
  'modelList.viewAll': 'View all models',

  // Trial Models
  'trial.privacyTitle': '',
  'trial.privacyDesc': 'Your prompts and chat history are never saved to our servers or used for AI training.',
  'trial.coldStartTitle': 'Initial Load Time: ',
  'trial.coldStartDesc': 'Open Weights models load cloud GPUs on-demand upon the first request. The first prompt will take about 1 to 3 minutes, but subsequent responses will be instantaneous.',
} as const;

export type TranslationKey = keyof typeof en;
export default en;
