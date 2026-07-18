// @vitest-environment node
/**
 * Guard: MCP generations inject the SAME brand context the app injects, and a
 * project Claude creates through create_project produces that context. The
 * builder must stay backend-importable, keep its playground guard, and render
 * the fields the settings JSON carries.
 */
import { describe, test, expect } from 'vitest';
import { buildProjectContext } from '../../../src/lib/projectContext.ts';

describe('buildProjectContext under Node (MCP injection guard)', () => {
  test('renders brand fields from a project shape', () => {
    const context = buildProjectContext({
      id: 'proj-1',
      name: 'Aleen Fashion',
      type: 'fashion',
      subtype: 'Editorial',
      clientName: 'Aleen',
      clientIndustry: 'Fashion',
      description: 'SS26 capsule launch',
      targetAudience: 'Gen-Z women',
      visualMood: ['luxury', 'minimal'],
      primaryColor: '#101010',
      styleKeywords: 'silk, editorial, soft light',
      negativeKeywords: 'clutter, neon',
      aiInstructions: 'Always keep garments center frame.',
    } as any);

    expect(context).toContain('Project: Aleen Fashion');
    expect(context).toContain('Client: Aleen (Fashion)');
    expect(context).toContain('Style keywords: silk, editorial, soft light');
    expect(context).toContain('Avoid: clutter, neon');
    expect(context).toContain('Instructions: Always keep garments center frame.');
  });

  test('the settings that create_project writes render as brand context', () => {
    // Mirrors what create_project stores: flat brand fields become `settings`,
    // then get_project/generation read them back through buildProjectContext.
    const settings = {
      type: 'branding',
      clientName: 'Nadi',
      primaryColor: '#0097A7',
      styleKeywords: 'clean, geometric',
      negativeKeywords: 'gradients',
      aiInstructions: 'Flat vector only.',
      status: 'active',
    };
    const context = buildProjectContext({ id: 'p2', name: 'Nadi Rebrand', ...settings } as any);
    expect(context).toContain('Client: Nadi');
    expect(context).toContain('Style keywords: clean, geometric');
    expect(context).toContain('Instructions: Flat vector only.');
  });

  test('the playground sentinel yields no context', () => {
    expect(buildProjectContext({ id: 'playground', name: 'Playground' } as any)).toBe('');
  });

  test('null/empty projects yield no context', () => {
    expect(buildProjectContext(null)).toBe('');
    expect(buildProjectContext({ id: 'x' } as any)).toBe('');
  });
});
