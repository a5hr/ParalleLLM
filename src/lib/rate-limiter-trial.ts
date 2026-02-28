interface TrialRateLimitEntry {
    count: number;
    resetAt: number;
}

const trialLimits = new Map<string, TrialRateLimitEntry>();

// 20 requests per 24 hours
const WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_TRIAL_REQUESTS = 20;

export function checkTrialRateLimit(clientId: string): { allowed: boolean; retryAfterMs?: number } {
    const now = Date.now();
    const entry = trialLimits.get(clientId);

    if (!entry || now > entry.resetAt) {
        trialLimits.set(clientId, { count: 1, resetAt: now + WINDOW_MS });
        return { allowed: true };
    }

    if (entry.count >= MAX_TRIAL_REQUESTS) {
        return { allowed: false, retryAfterMs: entry.resetAt - now };
    }

    entry.count++;
    return { allowed: true };
}
