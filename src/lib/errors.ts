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
