import { providerRegistry } from '@/lib/providers';
import type { ModelInfo } from '@/types/provider';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const allModels: ModelInfo[] = [];

    for (const [name, provider] of providerRegistry) {
      try {
        if (provider.type === 'local') {
          // For local providers, try to discover models but don't fail if unavailable
          const models = await Promise.race([
            provider.listModels(),
            new Promise<ModelInfo[]>((_, reject) =>
              setTimeout(() => reject(new Error('timeout')), 3000)
            ),
          ]);
          // Prefix local model IDs with provider name for identification
          allModels.push(
            ...models.map(m => ({
              ...m,
              id: `${name}/${m.id}`,
              provider: name,
            }))
          );
        } else {
          const models = await provider.listModels();
          allModels.push(...models);
        }
      } catch {
        // Skip providers that fail (e.g., local LLM not running)
      }
    }

    return Response.json({ models: allModels });
  } catch (error) {
    console.error('Models API error:', error);
    return Response.json(
      { error: 'Failed to fetch models' },
      { status: 500 }
    );
  }
}
