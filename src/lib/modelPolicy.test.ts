import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { DEFAULT_TEXT_MODEL, TEXT_MODELS, DEFAULT_MODEL_FOR_MODE, modelsForMode, resolveTextModel } from './models';

describe('text model policy', () => {
  it('offers exactly one text model', () => {
    expect(TEXT_MODELS).toHaveLength(1);
    expect(TEXT_MODELS[0].id).toBe(DEFAULT_TEXT_MODEL);
    expect(DEFAULT_TEXT_MODEL).toBe('gemini-3.6-flash');
  });

  it('drives the chat picker and the per-mode default from the same constant', () => {
    expect(modelsForMode('text').map((m) => m.id)).toEqual([DEFAULT_TEXT_MODEL]);
    expect(DEFAULT_MODEL_FOR_MODE.text).toBe(DEFAULT_TEXT_MODEL);
  });

  describe('resolveTextModel', () => {
    it('passes through a currently offered model', () => {
      expect(resolveTextModel(DEFAULT_TEXT_MODEL)).toBe(DEFAULT_TEXT_MODEL);
    });

    it('upgrades retired ids saved in old workflows', () => {
      for (const retired of ['gemini-3-flash-preview', 'gemini-3.5-flash', 'gemini-3.1-pro-preview', 'gemini-3.1-flash-lite']) {
        expect(resolveTextModel(retired)).toBe(DEFAULT_TEXT_MODEL);
      }
    });

    it('falls back when nothing is stored', () => {
      expect(resolveTextModel(undefined)).toBe(DEFAULT_TEXT_MODEL);
      expect(resolveTextModel(null)).toBe(DEFAULT_TEXT_MODEL);
      expect(resolveTextModel('')).toBe(DEFAULT_TEXT_MODEL);
    });
  });
});

/**
 * Architecture guard.
 *
 * Model ids used to be bare string literals in ~20 files across the frontend
 * services, canvas nodes, graph runner and MCP tools, so changing a model meant
 * hunting strings and retired ids lingered unnoticed. Every id now lives in the
 * registry (models.ts) or the rate table (pricing.ts) and everything else
 * imports from them. This test fails if a literal creeps back in anywhere else.
 */
describe('no stray model ids', () => {
  const ROOT = path.resolve(__dirname, '../..');
  const SCAN_DIRS = ['src', 'backend'];

  /** Where writing a model id down is the whole point. */
  const ALLOWED = [
    path.join('src', 'lib', 'models.ts'),
    path.join('src', 'lib', 'pricing.ts'),
    path.join('src', 'nodes', 'imagenModels.ts'), // image model registry
  ];

  // Every family the studio calls. The imagen pattern requires a version dot
  // (`imagen-4.0-…`) so it can't match node ids like `imagen-1` in fixtures.
  const MODEL_LITERAL = /['"`](gemini-[0-9][\w.-]*|veo-[0-9][\w.-]*|lyria-[0-9][\w.-]*|imagen-[0-9]+\.[0-9][\w.-]*)['"`]/g;

  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;
        walk(full, out);
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        out.push(full);
      }
    }
    return out;
  }

  it('keeps model ids out of every file except the registries', () => {
    const offenders: string[] = [];

    for (const dir of SCAN_DIRS) {
      for (const file of walk(path.join(ROOT, dir))) {
        const rel = path.relative(ROOT, file);
        // Tests legitimately name specific models in fixtures and assertions.
        if (/\.test\.tsx?$/.test(rel) || rel.includes(`__tests__`)) continue;
        if (ALLOWED.some((allowed) => rel === allowed)) continue;

        const matches = fs.readFileSync(file, 'utf8').match(MODEL_LITERAL) ?? [];
        if (matches.length) offenders.push(`${rel}: ${[...new Set(matches)].join(', ')}`);
      }
    }

    expect(offenders, `Import the id from src/lib/models.ts instead:\n${offenders.join('\n')}`).toEqual([]);
  });
});
