import { describe, it, expect } from 'vitest';
import { defaultModels, formatTokens, formatPrice } from './models';
import modelsData from '../../data/models.json';

describe('formatTokens', () => {
  it('formats thousands as K', () => {
    expect(formatTokens(1000)).toBe('1K');
    expect(formatTokens(200000)).toBe('200K');
    expect(formatTokens(32768)).toBe('33K');
  });

  it('formats millions as M', () => {
    expect(formatTokens(1000000)).toBe('1M');
    expect(formatTokens(1048576)).toBe('1.0M');
  });

  it('formats fractional millions with one decimal', () => {
    expect(formatTokens(1500000)).toBe('1.5M');
  });

  it('returns raw number for values under 1000', () => {
    expect(formatTokens(500)).toBe('500');
    expect(formatTokens(1)).toBe('1');
  });
});

describe('formatPrice', () => {
  it('formats prices >= 1 with minimal decimals', () => {
    expect(formatPrice(3)).toBe('$3');
    expect(formatPrice(1.75)).toBe('$1.75');
    expect(formatPrice(5)).toBe('$5');
  });

  it('formats prices < 1 with two decimals', () => {
    expect(formatPrice(0.15)).toBe('$0.15');
    expect(formatPrice(0.6)).toBe('$0.60');
  });
});

describe('model definitions integrity', () => {
  it('defaultModels is not empty', () => {
    expect(defaultModels.length).toBeGreaterThan(0);
  });

  it('every model has maxOutput <= maxTokens (context)', () => {
    for (const model of defaultModels) {
      expect(
        model.maxOutput,
        `${model.id}: maxOutput (${model.maxOutput}) should be <= maxTokens (${model.maxTokens})`
      ).toBeLessThanOrEqual(model.maxTokens);
    }
  });

  it('every model id exists in the provider mapping', () => {
    const providerMap: Record<string, string> = Object.fromEntries(
      modelsData.map((m) => [m.id, m.provider])
    );

    for (const model of defaultModels) {
      expect(
        providerMap[model.id],
        `${model.id} should have a provider mapping`
      ).toBeDefined();
    }
  });

  it('every model has required fields', () => {
    for (const model of defaultModels) {
      expect(model.id).toBeTruthy();
      expect(model.name).toBeTruthy();
      expect(model.provider).toBeTruthy();
      expect(['cloud', 'local']).toContain(model.providerType);
      expect(model.maxTokens).toBeGreaterThan(0);
      expect(model.maxOutput).toBeGreaterThan(0);
    }
  });

  it('free models have null pricing', () => {
    for (const model of defaultModels) {
      if (model.isFree) {
        expect(model.pricing, `${model.id} is free but has pricing`).toBeNull();
      }
    }
  });

  it('paid models have valid pricing', () => {
    for (const model of defaultModels) {
      if (!model.isFree && model.pricing) {
        expect(model.pricing.input).toBeGreaterThan(0);
        expect(model.pricing.output).toBeGreaterThan(0);
      }
    }
  });
});
