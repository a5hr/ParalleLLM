import { NextRequest } from 'next/server';
import { executeParallel } from '@/lib/streaming/multi-stream';
import { createSSEStream } from '@/lib/streaming/sse-encoder';
import { chatRequestSchema } from '@/lib/validation';
import { checkRateLimit } from '@/lib/rate-limiter';
import { checkTrialRateLimit } from '@/lib/rate-limiter-trial';
import { defaultModels } from '@/lib/models';
import { resolveModelId } from '@/lib/providers';
import modelsData from '../../../../data/models.json';

export const runtime = 'nodejs';
export const maxDuration = 300;

const FALLBACK_MAX_OUTPUT = 4096;
const modelMaxOutput = new Map(defaultModels.map(m => [m.id, m.maxOutput]));
export const fixedTemperatureModels = new Set(defaultModels.filter(m => !m.supportsTemperature).map(m => m.id));

export const thinkingModels = new Set(
  modelsData
    .filter(m => m.supportedFeatures.some(f => f === 'reasoning' || f === 'extended-thinking'))
    .map(m => m.id)
);

/** Cap maxTokens to the known model limit, or a safe fallback for unknown models */
export function capMaxTokens(
  requestedMaxTokens: number,
  modelId: string,
  hasBaseUrl: boolean
): number {
  const serverMaxOutput = modelMaxOutput.get(modelId);
  if (serverMaxOutput) return Math.min(requestedMaxTokens, serverMaxOutput);
  if (hasBaseUrl) return requestedMaxTokens; // Custom/local — trust the user
  return Math.min(requestedMaxTokens, FALLBACK_MAX_OUTPUT); // Unknown cloud model
}

export async function POST(request: NextRequest) {
  try {
    const clientId = request.headers.get('x-forwarded-for') || 'anonymous';
    const rateLimit = checkRateLimit(clientId);
    if (!rateLimit.allowed) {
      return Response.json(
        { error: 'Rate limit exceeded', retryAfterMs: rateLimit.retryAfterMs },
        { status: 429 }
      );
    }

    const body = await request.json();

    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { messages, models, modelConfigs, temperature, maxTokens, apiKeys } = parsed.data;

    const hasTrialModels = models.some(model => {
      const resolved = resolveModelId(model);
      return defaultModels.find(m => m.id === resolved)?.provider === 'trial';
    });

    if (hasTrialModels) {
      const trialRateLimit = checkTrialRateLimit(clientId);
      if (!trialRateLimit.allowed) {
        return Response.json(
          { error: 'Trial limit exceeded', code: 'TRIAL_LIMIT_REACHED', retryAfterMs: trialRateLimit.retryAfterMs },
          { status: 429 }
        );
      }
    }

    const configMap = new Map(modelConfigs?.map(c => [c.id, c]));

    const requests = models.map(model => {
      // Resolve deprecated model aliases (e.g. deepseek-chat-v3-0324 → deepseek-r1-0528)
      const resolvedModel = resolveModelId(model);
      const perModel = configMap.get(model);
      const requestedMaxTokens = perModel?.maxTokens ?? maxTokens;
      const safeMaxTokens = capMaxTokens(requestedMaxTokens, resolvedModel, !!perModel?.baseUrl);

      const safeTemperature = fixedTemperatureModels.has(resolvedModel)
        ? undefined
        : (perModel?.temperature ?? temperature);

      const isThinkingModel = thinkingModels.has(resolvedModel);

      return {
        model: resolvedModel,
        request: {
          messages,
          model: resolvedModel,
          temperature: safeTemperature,
          maxTokens: safeMaxTokens,
          ...(isThinkingModel ? { thinking: true } : {}),
        },
        userApiKeys: apiKeys,
        providerHint: perModel?.provider,
        baseUrl: perModel?.baseUrl,
      };
    });

    const parallelStream = executeParallel(requests);
    const sseStream = createSSEStream(parallelStream);

    return new Response(sseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
