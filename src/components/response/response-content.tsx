'use client';

import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { StreamingCursor } from './streaming-cursor';
import { useT } from '@/store/locale-store';

interface ResponseContentProps {
  content: string;
  isStreaming: boolean;
}

export function ResponseContent({ content, isStreaming }: ResponseContentProps) {
  const { t } = useT();
  const markdown = useMemo(() => {
    if (!content) return null;
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ children, ...props }) {
            return (
              <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-sm" {...props}>
                {children}
              </pre>
            );
          },
          code({ children, className, ...props }) {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="rounded bg-muted px-1.5 py-0.5 text-sm" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          table({ children, ...props }) {
            return (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm" {...props}>
                  {children}
                </table>
              </div>
            );
          },
          th({ children, ...props }) {
            return (
              <th className="border border-border px-3 py-2 text-left font-semibold bg-muted" {...props}>
                {children}
              </th>
            );
          },
          td({ children, ...props }) {
            return (
              <td className="border border-border px-3 py-2" {...props}>
                {children}
              </td>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    );
  }, [content]);

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none break-words">
      {content ? markdown : (
        <span className="text-muted-foreground text-sm">{t('response.waiting')}</span>
      )}
      {isStreaming && <StreamingCursor />}
    </div>
  );
}
