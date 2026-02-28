export interface SSEMessage {
    event: string;
    data: unknown;
}

/**
 * Parses an SSE (Server-Sent Events) Response body into an async generator of typed messages.
 */
export async function* parseSSEStream(response: Response): AsyncGenerator<SSEMessage, void, unknown> {
    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
            if (!part.trim()) continue;

            const lines = part.split('\n');
            let eventType = '';
            let dataStr = '';

            for (const line of lines) {
                if (line.startsWith('event: ')) {
                    eventType = line.slice(7).trim();
                } else if (line.startsWith('data: ')) {
                    dataStr = line.slice(6);
                }
            }

            if (!dataStr) continue;

            try {
                const data = JSON.parse(dataStr);
                yield { event: eventType, data };
            } catch {
                // Skip malformed JSON
            }
        }
    }
}
