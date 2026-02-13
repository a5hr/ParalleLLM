import type { StreamChunk } from '@/types/provider';

export function encodeSSE(eventType: string, data: unknown): string {
  const json = JSON.stringify(data);
  return `event: ${eventType}\ndata: ${json}\n\n`;
}

export function createSSEStream(
  source: AsyncIterable<StreamChunk>
): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        for await (const chunk of source) {
          const eventType = chunk.type === 'error' ? 'error' : 'chunk';
          const sseData = encodeSSE(eventType, chunk);
          controller.enqueue(encoder.encode(sseData));
        }

        controller.enqueue(
          encoder.encode(encodeSSE('done', {}))
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal error';
        controller.enqueue(
          encoder.encode(encodeSSE('error', { type: 'error', content: message }))
        );
      } finally {
        controller.close();
      }
    },
  });
}
