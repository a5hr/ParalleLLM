import { NextRequest } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

const testRequestSchema = z.object({
  provider: z.string(),
  baseUrl: z.string().url().optional(),
  apiKey: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = testRequestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { provider, baseUrl, apiKey } = parsed.data;

    // For local LLM providers, test connectivity by fetching the models endpoint
    if (provider === 'ollama' || provider === 'lmstudio' || provider === 'custom') {
      const url = baseUrl || (provider === 'ollama'
        ? (process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1')
        : 'http://localhost:1234/v1');

      try {
        const response = await fetch(`${url}/models`, {
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          return Response.json({ success: true, message: `Connected to ${provider}` });
        }
        return Response.json(
          { success: false, message: `${provider} returned status ${response.status}` },
          { status: 400 }
        );
      } catch {
        return Response.json(
          { success: false, message: `Cannot connect to ${provider} at ${url}` },
          { status: 400 }
        );
      }
    }

    // For cloud providers, test by validating the API key format
    if (!apiKey) {
      return Response.json(
        { success: false, message: 'API key is required for cloud providers' },
        { status: 400 }
      );
    }

    return Response.json({ success: true, message: `API key provided for ${provider}` });
  } catch (error) {
    console.error('Provider test error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
