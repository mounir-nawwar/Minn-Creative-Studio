import type { Project } from '../types/project.types';

/**
 * Builds the project "brief" string injected into every AI generation
 * (Imagen, Veo, LLM, prompt enhancer, chat). Centralized so the whole
 * creative brief — not just a couple of fields — actually reaches the model.
 * Only non-empty fields are included.
 */
export function buildProjectContext(project?: Partial<Project> | null): string {
  if (!project) return '';

  const colors = [project.primaryColor, project.secondaryColor, project.accentColor].filter(Boolean);
  const client = project.clientName
    ? `Client: ${project.clientName}${project.clientIndustry ? ` (${project.clientIndustry})` : ''}`
    : '';

  const lines = [
    project.name && `Project: ${project.name}`,
    project.type && `Type: ${project.type}${project.subtype ? ` / ${project.subtype}` : ''}`,
    client,
    project.description && `Description: ${project.description}`,
    project.targetAudience && `Target audience: ${project.targetAudience}`,
    project.brandPersonality && `Brand tone: ${project.brandPersonality}`,
    project.visualMood?.length && `Visual mood: ${project.visualMood.join(', ')}`,
    colors.length && `Brand colors: ${colors.join(', ')}`,
    project.styleKeywords && `Style keywords: ${project.styleKeywords}`,
    project.negativeKeywords && `Avoid: ${project.negativeKeywords}`,
    project.aiInstructions && `Instructions: ${project.aiInstructions}`,
  ].filter(Boolean);

  return lines.join('\n');
}
