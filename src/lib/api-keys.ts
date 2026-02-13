type ProviderName = 'openai' | 'anthropic' | 'google' | 'groq' | 'openrouter';

const envKeyMap: Record<ProviderName, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_API_KEY',
  groq: 'GROQ_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
};

const cloudProviders = new Set(Object.keys(envKeyMap));

export function resolveApiKey(
  provider: string,
  userApiKeys?: Record<string, string>
): string {
  // Cloud provider — needs a key
  if (cloudProviders.has(provider)) {
    const userKey = userApiKeys?.[provider];
    if (userKey) return userKey;

    const envVar = envKeyMap[provider as ProviderName];
    const envKey = process.env[envVar];
    if (envKey) return envKey;

    throw new Error(
      `No API key for "${provider}". Set ${envVar} or enter it in Settings.`
    );
  }

  // Local / unknown provider — no key needed
  return 'not-needed';
}
