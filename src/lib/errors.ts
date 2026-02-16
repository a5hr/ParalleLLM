export type ProviderErrorCode =
  | 'AUTH_ERROR'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'MODEL_NOT_FOUND'
  | 'CONTENT_FILTER'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export class ProviderError extends Error {
  constructor(
    public provider: string,
    public model: string,
    public code: ProviderErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

/** Detect 429 / rate-limit errors from any provider SDK. */
export function isRateLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  // OpenAI SDK: APIError with status 429
  if ('status' in error && (error as { status: number }).status === 429) return true;
  // Anthropic SDK: APIError with status 429
  // Google SDK & generic: check message
  const msg = error.message.toLowerCase();
  return msg.includes('429') || msg.includes('rate limit') || msg.includes('rate_limit');
}
