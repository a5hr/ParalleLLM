'use client';

import { useRef, useEffect, useCallback } from 'react';

export function useAutoScroll(isStreaming: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    userScrolledRef.current = distanceFromBottom > 50;
  }, []);

  useEffect(() => {
    if (!isStreaming) {
      userScrolledRef.current = false;
      return;
    }

    const interval = setInterval(() => {
      const el = containerRef.current;
      if (el && !userScrolledRef.current) {
        el.scrollTop = el.scrollHeight;
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isStreaming]);

  return { containerRef, handleScroll };
}
