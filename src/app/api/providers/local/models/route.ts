import { NextRequest } from 'next/server';
import { createOpenAICompatibleProvider } from '@/lib/providers/openai-compatible';
import { validateLocalBaseUrl } from '@/lib/url-validation';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider') || 'ollama';
    const baseUrl = searchParams.get('baseUrl') ||
      (provider === 'ollama'
        ? (process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1')
        : 'http://localhost:1234/v1');

    const urlCheck = validateLocalBaseUrl(baseUrl);
    if (!urlCheck.valid) {
      return Response.json(
        { error: `Blocked: ${urlCheck.reason}`, models: [] },
        { status: 403 }
      );
    }

    const localProvider = createOpenAICompatibleProvider({
      name: provider,
      type: 'local',
      baseUrl,
      requiresApiKey: false,
      defaultModels: [],
      supportsModelDiscovery: true,
    });

    const models = await Promise.race([
      localProvider.listModels(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout connecting to local LLM')), 5000)
      ),
    ]);

    return Response.json({ models });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch local models';
    return Response.json(
      { error: message, models: [] },
      { status: 503 }
    );
  }
}
