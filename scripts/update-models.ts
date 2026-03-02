import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── Types ──────────────────────────────────────────────────────────────

interface ModelEntry {
  id: string;
  name: string;
  provider: string;
  providerType: 'cloud' | 'local';
  isFree: boolean;
  maxTokens: number;
  maxOutput: number;
  pricing: { input: number; output: number } | null;
  supportedFeatures: string[];
  supportsTemperature?: boolean;
}

interface ProviderDefaults {
  providerType: 'cloud' | 'local';
  isFree: boolean;
  pricing?: { input: number; output: number } | null;
  maxTokens?: number;
  maxOutput?: number;
  supportedFeatures: string[];
  supportsTemperature?: boolean;
}

interface OverridesConfig {
  providerDefaults: Record<string, ProviderDefaults>;
  include: Record<string, string[]>;
  overrides: Record<string, Partial<ModelEntry>>;
  static?: ModelEntry[];
}

interface ApiModelData {
  id: string;
  name?: string;
  maxTokens?: number;
  maxOutput?: number;
  pricing?: { input: number; output: number } | null;
}

// ── Paths ──────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const OVERRIDES_PATH = resolve(ROOT, 'data/model-overrides.json');
const MODELS_PATH = resolve(ROOT, 'data/models.json');
const REPORT_PATH = resolve(ROOT, 'data/update-report.md');

// ── CLI flags ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');

function log(...msg: unknown[]) {
  console.log(...msg);
}
function verbose(...msg: unknown[]) {
  if (VERBOSE) console.log('  [verbose]', ...msg);
}

// ── Config ─────────────────────────────────────────────────────────────

function readOverrides(): OverridesConfig {
  return JSON.parse(readFileSync(OVERRIDES_PATH, 'utf-8'));
}

function readExistingModels(): ModelEntry[] {
  if (!existsSync(MODELS_PATH)) return [];
  try {
    return JSON.parse(readFileSync(MODELS_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

// ── API fetchers ───────────────────────────────────────────────────────

async function fetchOpenAI(apiKey: string): Promise<ApiModelData[]> {
  verbose('Fetching OpenAI models...');
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`OpenAI API ${res.status}`);
  const data = (await res.json()) as { data: Array<{ id: string }> };
  return data.data.map((m) => ({ id: m.id }));
}

async function fetchAnthropic(apiKey: string): Promise<ApiModelData[]> {
  verbose('Fetching Anthropic models...');
  const allModels: ApiModelData[] = [];
  let afterId: string | undefined;

  // Paginate through all models
  for (; ;) {
    const url = new URL('https://api.anthropic.com/v1/models');
    url.searchParams.set('limit', '100');
    if (afterId) url.searchParams.set('after_id', afterId);

    const res = await fetch(url, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}`);

    const data = (await res.json()) as {
      data: Array<{ id: string; display_name: string }>;
      has_more: boolean;
      last_id: string;
    };

    for (const m of data.data) {
      allModels.push({ id: m.id, name: m.display_name });
    }

    if (!data.has_more) break;
    afterId = data.last_id;
  }

  return allModels;
}

async function fetchGoogle(apiKey: string): Promise<ApiModelData[]> {
  verbose('Fetching Google models...');
  const url = new URL('https://generativelanguage.googleapis.com/v1beta/models');
  url.searchParams.set('key', apiKey);
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Google API ${res.status}`);
  const data = (await res.json()) as {
    models: Array<{ name: string; displayName?: string; inputTokenLimit?: number; outputTokenLimit?: number }>;
  };
  return data.models.map((m) => ({
    id: m.name.replace('models/', ''),
    name: m.displayName,
    maxTokens: m.inputTokenLimit,
    maxOutput: m.outputTokenLimit,
  }));
}

async function fetchGroq(apiKey: string): Promise<ApiModelData[]> {
  verbose('Fetching Groq models...');
  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Groq API ${res.status}`);
  const data = (await res.json()) as {
    data: Array<{ id: string; context_window?: number }>;
  };
  return data.data.map((m) => ({
    id: m.id,
    maxTokens: m.context_window,
  }));
}

async function fetchOpenRouter(): Promise<ApiModelData[]> {
  verbose('Fetching OpenRouter models...');
  const res = await fetch('https://openrouter.ai/api/v1/models', {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`OpenRouter API ${res.status}`);
  const data = (await res.json()) as {
    data: Array<{
      id: string;
      name?: string;
      context_length?: number;
      top_provider?: { max_completion_tokens?: number };
      pricing?: { prompt?: string; completion?: string };
    }>;
  };
  return data.data.map((m) => ({
    id: m.id,
    name: m.name,
    maxTokens: m.context_length,
    maxOutput: m.top_provider?.max_completion_tokens,
    pricing: (() => {
      const inp = m.pricing?.prompt ? parseFloat(m.pricing.prompt) : 0;
      const out = m.pricing?.completion ? parseFloat(m.pricing.completion) : 0;
      return inp > 0 || out > 0
        ? { input: inp * 1_000_000, output: out * 1_000_000 }
        : null;
    })(),
  }));
}

type Fetcher = (apiKey: string) => Promise<ApiModelData[]>;

const fetchers: Record<string, { fetch: Fetcher; envKey: string; requiresKey: boolean }> = {
  openai: { fetch: fetchOpenAI, envKey: 'OPENAI_API_KEY', requiresKey: true },
  anthropic: { fetch: fetchAnthropic, envKey: 'ANTHROPIC_API_KEY', requiresKey: true },
  google: { fetch: fetchGoogle, envKey: 'GOOGLE_API_KEY', requiresKey: true },
  groq: { fetch: fetchGroq, envKey: 'GROQ_API_KEY', requiresKey: true },
  openrouter: {
    fetch: fetchOpenRouter as unknown as Fetcher,
    envKey: '',
    requiresKey: false,
  },
};

// ── Build logic ────────────────────────────────────────────────────────

function buildModel(
  id: string,
  provider: string,
  defaults: ProviderDefaults,
  apiData: ApiModelData | undefined,
  override: Partial<ModelEntry> | undefined,
  fallback?: ModelEntry
): ModelEntry {
  return {
    id,
    name: override?.name ?? apiData?.name ?? id,
    provider,
    providerType: override?.providerType ?? defaults.providerType,
    isFree: override?.isFree ?? defaults.isFree,
    maxTokens:
      apiData?.maxTokens ?? override?.maxTokens ?? defaults.maxTokens ?? 128_000,
    maxOutput:
      apiData?.maxOutput ?? override?.maxOutput ?? defaults.maxOutput ?? 4096,
    pricing:
      apiData?.pricing !== undefined
        ? apiData.pricing
        : override?.pricing !== undefined
          ? override.pricing
          : defaults.pricing !== undefined
            ? defaults.pricing
            : null,
    supportedFeatures: override?.supportedFeatures ?? defaults.supportedFeatures,
    supportsTemperature: override?.supportsTemperature ?? defaults.supportsTemperature ?? fallback?.supportsTemperature,
  };
}

// ── Report generation ──────────────────────────────────────────────────

interface ReviewReport {
  newModels: Array<{ provider: string; id: string; name?: string }>;
  missingModels: Array<{ provider: string; id: string }>;
  pricingChanges: Array<{ id: string; field: string; old: unknown; new: unknown }>;
  manualReviewItems: string[];
}

function generateReport(report: ReviewReport): string {
  const lines: string[] = ['# Model Update Review Report', ''];

  const hasContent =
    report.newModels.length > 0 ||
    report.missingModels.length > 0 ||
    report.pricingChanges.length > 0 ||
    report.manualReviewItems.length > 0;

  if (!hasContent) {
    lines.push('✅ No review items. All changes are auto-applied.', '');
    return lines.join('\n');
  }

  if (report.newModels.length > 0) {
    lines.push('## 🆕 New Models Detected (not in `include`)', '');
    lines.push('The following models were found on provider APIs but are not in `data/model-overrides.json` `include` list.', '');
    lines.push('| Provider | Model ID | Display Name |');
    lines.push('|----------|----------|-------------|');
    for (const m of report.newModels) {
      lines.push(`| ${m.provider} | \`${m.id}\` | ${m.name ?? '-'} |`);
    }
    lines.push('', 'To add them, update the `include` section in `data/model-overrides.json`.', '');
  }

  if (report.missingModels.length > 0) {
    lines.push('## ⚠️ Models Not Found on API', '');
    lines.push('The following models are in `include` but were not found on the provider API. They may have been deprecated.', '');
    lines.push('| Provider | Model ID |');
    lines.push('|----------|----------|');
    for (const m of report.missingModels) {
      lines.push(`| ${m.provider} | \`${m.id}\` |`);
    }
    lines.push('', 'Consider removing them from `include` in `data/model-overrides.json`.', '');
  }

  if (report.pricingChanges.length > 0) {
    lines.push('## 💰 Pricing / Limit Changes', '');
    lines.push('| Model ID | Field | Old | New |');
    lines.push('|----------|-------|-----|-----|');
    for (const c of report.pricingChanges) {
      lines.push(`| \`${c.id}\` | ${c.field} | ${JSON.stringify(c.old)} | ${JSON.stringify(c.new)} |`);
    }
    lines.push('');
  }

  if (report.manualReviewItems.length > 0) {
    lines.push('## 📋 Manual Review Required', '');
    for (const item of report.manualReviewItems) {
      lines.push(`- ${item}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  log('Updating model definitions...\n');

  const config = readOverrides();
  const existing = readExistingModels();
  const existingByProvider = new Map<string, Map<string, ModelEntry>>();
  for (const m of existing) {
    if (!existingByProvider.has(m.provider))
      existingByProvider.set(m.provider, new Map());
    existingByProvider.get(m.provider)!.set(m.id, m);
  }

  const report: ReviewReport = {
    newModels: [],
    missingModels: [],
    pricingChanges: [],
    manualReviewItems: [],
  };

  // Collect models per provider (unordered)
  const byProvider = new Map<string, ModelEntry[]>();

  // Process each API provider
  const apiProviders = ['openai', 'anthropic', 'google', 'groq', 'openrouter'];

  for (const provider of apiProviders) {
    const includeList = config.include[provider];
    if (!includeList?.length) continue;

    const defaults = config.providerDefaults[provider];
    if (!defaults) {
      log(`  Warning: no providerDefaults for ${provider}, skipping`);
      continue;
    }

    // Try fetching from API
    const apiModels = new Map<string, ApiModelData>();
    const fetcherConfig = fetchers[provider];
    let fetchSuccess = false;
    if (fetcherConfig) {
      const apiKey = fetcherConfig.envKey ? process.env[fetcherConfig.envKey] : '';
      if (!fetcherConfig.requiresKey || apiKey) {
        try {
          const raw = await fetcherConfig.fetch(apiKey || '');
          for (const m of raw) apiModels.set(m.id, m);
          log(`  ${provider}: fetched ${apiModels.size} models from API`);
          fetchSuccess = true;
        } catch (err) {
          // Sanitize error message to prevent API key leakage in logs
          const msg = err instanceof Error ? err.message : String(err);
          const safeMsg = apiKey ? msg.replaceAll(apiKey, '***') : msg;
          log(`  ${provider}: API fetch failed (${safeMsg}), using fallback`);
        }
      } else {
        log(`  ${provider}: no API key ($${fetcherConfig.envKey}), using fallback`);
      }
    }

    // Detect new models not in include list
    if (fetchSuccess && apiModels.size > 0) {
      const includeSet = new Set(includeList);
      for (const [apiId, apiData] of apiModels) {
        if (!includeSet.has(apiId)) {
          // Apply provider-specific filtering to reduce noise
          if (shouldReportNewModel(provider, apiId)) {
            report.newModels.push({ provider, id: apiId, name: apiData.name });
          }
        }
      }

      // Detect models in include but not on API
      for (const modelId of includeList) {
        if (!apiModels.has(modelId)) {
          report.missingModels.push({ provider, id: modelId });
          verbose(`  ${provider}: ${modelId} not found on API`);
        }
      }
    }

    // Build entries for included models
    const providerModels: ModelEntry[] = [];
    for (const modelId of includeList) {
      const apiData = apiModels.get(modelId);
      const override = config.overrides[modelId];
      const fallback = existingByProvider.get(provider)?.get(modelId);

      // If no API data, use existing model data as fallback source
      const effectiveApiData: ApiModelData | undefined = apiData ??
        (fallback
          ? {
            id: fallback.id,
            name: fallback.name,
            maxTokens: fallback.maxTokens,
            maxOutput: fallback.maxOutput,
            pricing: fallback.pricing,
          }
          : undefined);

      const model = buildModel(modelId, provider, defaults, effectiveApiData, override, fallback);

      // Track pricing/limit changes
      if (fallback) {
        trackChanges(fallback, model, report);
      }

      providerModels.push(model);
      verbose(`  ${modelId} -> ${model.name}`);
    }

    byProvider.set(provider, providerModels);
  }

  // Add Anthropic-specific manual review note if no pricing from API
  const anthropicInInclude = config.include['anthropic'];
  if (anthropicInInclude?.length) {
    const hasPricingOverrides = anthropicInInclude.some(id => config.overrides[id]?.pricing !== undefined);
    if (!hasPricingOverrides) {
      report.manualReviewItems.push(
        'Anthropic API does not provide pricing info. Please verify pricing in `overrides` is up-to-date: https://docs.anthropic.com/en/docs/about-claude/pricing'
      );
    }
  }

  // Add static entries (no API, e.g. trial provider)
  if (config.static?.length) {
    for (const m of config.static) {
      const list = byProvider.get(m.provider) ?? [];
      list.push(m);
      byProvider.set(m.provider, list);
    }
    log(`  static: added ${config.static.length} entries`);
  }

  // Assemble in desired provider order
  const providerOrder = ['trial', 'openai', 'anthropic', 'google', 'groq', 'openrouter'];
  const result: ModelEntry[] = [];
  for (const provider of providerOrder) {
    const models = byProvider.get(provider);
    if (models) result.push(...models);
  }
  // Append any providers not in the order list
  for (const [provider, models] of byProvider) {
    if (!providerOrder.includes(provider)) result.push(...models);
  }

  // Validate
  const ids = new Set<string>();
  for (const m of result) {
    if (ids.has(m.id)) {
      log(`Error: Duplicate model ID: ${m.id}`);
      process.exit(1);
    }
    ids.add(m.id);
    if (!m.name || !m.provider || !m.providerType) {
      log(`Error: Invalid model entry: ${JSON.stringify(m)}`);
      process.exit(1);
    }
  }

  log(`\nTotal: ${result.length} models\n`);

  // Diff
  const newJson = JSON.stringify(result, null, 2);
  const oldJson = existsSync(MODELS_PATH)
    ? readFileSync(MODELS_PATH, 'utf-8').trim()
    : '';

  if (newJson === oldJson) {
    log('No changes detected.');
  } else {
    // Show summary of changes
    const oldIds = new Set(existing.map((m) => m.id));
    const newIds = new Set(result.map((m) => m.id));
    const added = result.filter((m) => !oldIds.has(m.id));
    const removed = existing.filter((m) => !newIds.has(m.id));
    const kept = result.filter((m) => oldIds.has(m.id));

    if (added.length) log(`  + Added: ${added.map((m) => m.id).join(', ')}`);
    if (removed.length) log(`  - Removed: ${removed.map((m) => m.id).join(', ')}`);

    const existingMap = new Map(existing.map((m) => [m.id, m]));
    let changedCount = 0;
    for (const m of kept) {
      const old = existingMap.get(m.id)!;
      if (JSON.stringify(m) !== JSON.stringify(old)) {
        changedCount++;
        if (VERBOSE) log(`  ~ Modified: ${m.id}`);
      }
    }
    if (changedCount) log(`  ~ Modified: ${changedCount} model(s)`);

    if (!DRY_RUN) {
      writeFileSync(MODELS_PATH, newJson + '\n');
      log(`Written to ${MODELS_PATH}`);
    } else {
      log('\nDry run -- no model file written.');
    }
  }

  // Generate review report
  const reportContent = generateReport(report);
  writeFileSync(REPORT_PATH, reportContent);
  log(`Review report written to ${REPORT_PATH}`);

  if (report.newModels.length > 0) {
    log(`\n📋 ${report.newModels.length} new model(s) detected on APIs (not in include list).`);
  }
  if (report.missingModels.length > 0) {
    log(`⚠️  ${report.missingModels.length} model(s) in include list not found on APIs.`);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

/** Filter out noisy/irrelevant models from new-model detection */
function shouldReportNewModel(provider: string, id: string): boolean {
  const lower = id.toLowerCase();

  // OpenAI: only report chat models, skip embeddings/audio/image/etc
  if (provider === 'openai') {
    const skip = ['embed', 'tts', 'whisper', 'dall-e', 'davinci', 'babbage', 'moderation', 'realtime', 'computer'];
    return !skip.some(s => lower.includes(s));
  }

  // Google: only report gemini models
  if (provider === 'google') {
    return lower.includes('gemini');
  }

  // Groq: report all
  if (provider === 'groq') {
    return true;
  }

  // OpenRouter: only report free models (to match the free-tier focus)
  if (provider === 'openrouter') {
    return lower.endsWith(':free');
  }

  // Anthropic: only report Claude models
  if (provider === 'anthropic') {
    return lower.includes('claude');
  }

  return true;
}

/** Track changes between old and new model for reporting */
function trackChanges(old: ModelEntry, updated: ModelEntry, report: ReviewReport) {
  if (old.maxTokens !== updated.maxTokens) {
    report.pricingChanges.push({
      id: updated.id,
      field: 'maxTokens',
      old: old.maxTokens,
      new: updated.maxTokens,
    });
  }
  if (old.maxOutput !== updated.maxOutput) {
    report.pricingChanges.push({
      id: updated.id,
      field: 'maxOutput',
      old: old.maxOutput,
      new: updated.maxOutput,
    });
  }
  if (JSON.stringify(old.pricing) !== JSON.stringify(updated.pricing)) {
    report.pricingChanges.push({
      id: updated.id,
      field: 'pricing',
      old: old.pricing,
      new: updated.pricing,
    });
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
