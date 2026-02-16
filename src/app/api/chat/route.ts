import { NextRequest } from 'next/server';
import { executeParallel } from '@/lib/streaming/multi-stream';
import { createSSEStream } from '@/lib/streaming/sse-encoder';
import { chatRequestSchema } from '@/lib/validation';
import { checkRateLimit } from '@/lib/rate-limiter';
import { defaultModels } from '@/lib/models';

export const runtime = 'nodejs';
export const maxDuration = 120;

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

    const configMap = new Map(modelConfigs?.map(c => [c.id, c]));
    const modelMaxOutput = new Map(defaultModels.map(m => [m.id, m.maxOutput]));
    const FALLBACK_MAX_OUTPUT = 4096;

    const requests = models.map(model => {
      const perModel = configMap.get(model);
      const requestedMaxTokens = perModel?.maxTokens ?? maxTokens;
      const serverMaxOutput = modelMaxOutput.get(model);
      // Cap to known model limit, or fallback for unknown cloud models
      // Custom/local models (with baseUrl) are trusted
      const safeMaxTokens = serverMaxOutput
        ? Math.min(requestedMaxTokens, serverMaxOutput)
        : perModel?.baseUrl
          ? requestedMaxTokens
          : Math.min(requestedMaxTokens, FALLBACK_MAX_OUTPUT);

      return {
        model,
        request: {
          messages,
          model,
          temperature: perModel?.temperature ?? temperature,
          maxTokens: safeMaxTokens,
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
