type ProviderName = 'openai' | 'anthropic' | 'google' | 'groq' | 'openrouter';

const envKeyMap: Record<ProviderName, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_API_KEY',
  groq: 'GROQ_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
};

const cloudProviders = new Set(Object.keys(envKeyMap));

/**
 * Key pool for server-side keys.
 * Supports multiple keys per provider via comma-separated env vars:
 *   GROQ_API_KEY=key1,key2,key3
 *
 * On 429, call `markRateLimited(provider)` to rotate to the next key.
 */
interface KeyPoolEntry {
  keys: string[];
  index: number;
  cooldowns: Map<number, number>; // key index -> cooldown expiry timestamp
}

const keyPool = new Map<string, KeyPoolEntry>();

function getPoolEntry(provider: string): KeyPoolEntry | undefined {
  if (keyPool.has(provider)) return keyPool.get(provider)!;

  const envVar = envKeyMap[provider as ProviderName];
  if (!envVar) return undefined;

  const raw = process.env[envVar];
  if (!raw) return undefined;

  const keys = raw.split(',').map((k) => k.trim()).filter(Boolean);
  if (keys.length === 0) return undefined;

  const entry: KeyPoolEntry = { keys, index: 0, cooldowns: new Map() };
  keyPool.set(provider, entry);
  return entry;
}

function pickServerKey(provider: string): string | undefined {
  const entry = getPoolEntry(provider);
  if (!entry) return undefined;

  const now = Date.now();
  const len = entry.keys.length;

  // Try up to `len` keys starting from current index
  for (let i = 0; i < len; i++) {
    const idx = (entry.index + i) % len;
    const cooldownUntil = entry.cooldowns.get(idx) ?? 0;
    if (now >= cooldownUntil) {
      entry.index = (idx + 1) % len; // advance for next call (round-robin)
      return entry.keys[idx];
    }
  }

  // All keys are rate-limited — return the one with the earliest expiry
  let bestIdx = 0;
  let bestExpiry = Infinity;
  for (const [idx, expiry] of entry.cooldowns) {
    if (expiry < bestExpiry) {
      bestExpiry = expiry;
      bestIdx = idx;
    }
  }
  entry.index = (bestIdx + 1) % len;
  return entry.keys[bestIdx];
}

/** Mark the most recently used server key as rate-limited (60s cooldown). */
export function markRateLimited(provider: string, cooldownMs = 60_000): void {
  const entry = getPoolEntry(provider);
  if (!entry) return;

  // The last used index is (current - 1)
  const lastUsed = (entry.index - 1 + entry.keys.length) % entry.keys.length;
  entry.cooldowns.set(lastUsed, Date.now() + cooldownMs);
}

export function resolveApiKey(
  provider: string,
  userApiKeys?: Record<string, string>
): string {
  // Cloud provider — needs a key
  if (cloudProviders.has(provider)) {
    const userKey = userApiKeys?.[provider];
    if (userKey) return userKey;

    const serverKey = pickServerKey(provider);
    if (serverKey) return serverKey;

    const envVar = envKeyMap[provider as ProviderName];
    throw new Error(
      `No API key for "${provider}". Set ${envVar} or enter it in Settings.`
    );
  }

  // Local / unknown provider — no key needed
  return 'not-needed';
}

/** Check if the resolved key is a server key (not user-provided). */
export function isServerKey(
  provider: string,
  key: string,
  userApiKeys?: Record<string, string>
): boolean {
  const userKey = userApiKeys?.[provider];
  return !userKey || userKey !== key;
}
