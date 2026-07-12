// @vitest-environment node
/**
 * Guard test: the MCP `list_models` tool imports the frontend model registry
 * (src/lib/models.ts) directly from backend code. That only works while the
 * registry (and its single dependency, src/nodes/imagenModels.ts) stays free
 * of browser-only imports. If this test fails, someone added a browser import
 * to the registry — split the data out instead of breaking the MCP server.
 */
import { describe, test, expect } from 'vitest';
import { TEXT_MODELS, CHAT_IMAGE_MODELS, VIDEO_MODELS, AUDIO_MODELS, modelsForMode, findModel } from '../../../src/lib/models.ts';

describe('src/lib/models.ts loads under Node (MCP backend import guard)', () => {
  test('all four registries are non-empty', () => {
    expect(TEXT_MODELS.length).toBeGreaterThan(0);
    expect(CHAT_IMAGE_MODELS.length).toBeGreaterThan(0);
    expect(VIDEO_MODELS.length).toBeGreaterThan(0);
    expect(AUDIO_MODELS.length).toBeGreaterThan(0);
  });

  test('helpers work', () => {
    expect(modelsForMode('image')).toEqual(CHAT_IMAGE_MODELS);
    const first = TEXT_MODELS[0];
    expect(findModel(first.id)?.label).toBe(first.label);
  });

  test('every model has the fields the MCP list_models tool exposes', () => {
    for (const model of [...TEXT_MODELS, ...CHAT_IMAGE_MODELS, ...VIDEO_MODELS, ...AUDIO_MODELS]) {
      expect(model.id).toBeTruthy();
      expect(model.label).toBeTruthy();
      expect(['text', 'image', 'video', 'audio']).toContain(model.mode);
      expect(model.supports).toBeTypeOf('object');
      expect(model.defaults).toBeTypeOf('object');
    }
  });
});
