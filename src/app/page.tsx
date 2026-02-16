'use client';

import { Header } from '@/components/layout/header';
import { QuickStart } from '@/components/layout/quick-start';
import { ModelSelector } from '@/components/model-selector/model-selector';
import { PromptInput } from '@/components/prompt/prompt-input';
import { ResponseGrid } from '@/components/response/response-grid';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
        <QuickStart />
        <ModelSelector />
        <PromptInput />
        <ResponseGrid />
      </main>
    </div>
  );
}
