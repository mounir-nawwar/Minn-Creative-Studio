/**
 * Project brand context for MCP generations.
 *
 * The app injects buildProjectContext() (colors, style keywords, negative
 * keywords, AI instructions…) into every generation. MCP generations must be
 * exactly as brand-aware, so this adapter maps a projects DB row (settings
 * JSON) onto the same frontend builder — including its playground guard,
 * which keeps the sentinel's fake defaults out of prompts.
 */

import { buildProjectContext } from '../../src/lib/projectContext.ts';
import { projects } from '../services/database.ts';

/** Context string for a project id — '' for playground/unknown/blank projects. */
export function projectContextFor(projectId: string): string {
  const row = projects.findById(projectId);
  if (!row) return '';
  const settings = row.settings ?? {};
  return buildProjectContext({
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    type: settings.type,
    subtype: settings.subtype,
    clientName: settings.clientName,
    clientIndustry: settings.clientIndustry,
    targetAudience: settings.targetAudience,
    brandPersonality: settings.brandPersonality,
    visualMood: settings.visualMood,
    primaryColor: settings.primaryColor,
    secondaryColor: settings.secondaryColor,
    accentColor: settings.accentColor,
    styleKeywords: settings.styleKeywords,
    negativeKeywords: settings.negativeKeywords,
    aiInstructions: settings.aiInstructions,
  });
}
