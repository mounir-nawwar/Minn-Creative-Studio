/**
 * Cost Tracking Service for Minn Creative Studio
 * Tracks project usage costs in SQLite database
 */

import { db, projects, usageLogs } from './database.js';

// Types for cost tracking metadata
export interface CostMetadata {
  imageCount?: number;
  videoCount?: number;
  audioCount?: number;
  tokenCount?: number;
  type: 'image' | 'video' | 'audio' | 'text';
  model?: string;
}

/**
 * Update the total cost for a project
 * This adds to the existing total_cost in the usage JSON field
 */
export function updateProjectTotalCost(projectId: string, additionalCost: number): void {
  const stmt = db.prepare(`
    UPDATE projects 
    SET usage = json_set(
      COALESCE(usage, '{}'),
      '$.totalCost', COALESCE(json_extract(usage, '$.totalCost'), 0) + ?,
      '$.lastUpdated', datetime('now')
    ),
    updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  stmt.run(additionalCost, projectId);
}

/**
 * Get the current total cost for a project
 */
export function getProjectTotalCost(projectId: string): number {
  const project = projects.findById(projectId);
  if (!project) return 0;
  return (project.usage as any)?.totalCost || 0;
}

/**
 * Track a project usage cost
 * Inserts a record into usage_logs and updates the project's total cost
 * 
 * @param projectId - The project ID to track costs for
 * @param userId - The user ID who incurred the cost
 * @param cost - The cost amount in dollars
 * @param metadata - Additional metadata about the usage
 */
export async function trackProjectCost(
  projectId: string,
  userId: string,
  cost: number,
  metadata: CostMetadata
): Promise<void> {
  const { type, tokenCount, imageCount, videoCount, audioCount, model } = metadata;
  
  // Build metadata object with counts
  const logMetadata: Record<string, any> = {};
  if (imageCount !== undefined) logMetadata.imageCount = imageCount;
  if (videoCount !== undefined) logMetadata.videoCount = videoCount;
  if (audioCount !== undefined) logMetadata.audioCount = audioCount;
  if (model !== undefined) logMetadata.model = model;
  
  // Insert into usage_logs using the existing database method
  usageLogs.log(projectId, userId, type, cost, tokenCount || 0, logMetadata);
  
  // Log for debugging
  console.log(`[CostTracking] Project: ${projectId}, User: ${userId}, Cost: $${cost.toFixed(4)}, Type: ${type}${model ? `, Model: ${model}` : ''}`);
  
  // Update the project's total cost field in usage JSON
  updateProjectTotalCost(projectId, cost);
}

/**
 * Get usage logs for a project within a date range
 */
export async function getProjectUsageLogs(
  projectId: string,
  startDate?: Date,
  endDate?: Date
): Promise<any[]> {
  return usageLogs.getByProjectId(projectId, startDate, endDate);
}

/**
 * Calculate total cost for a project within a date range
 */
export async function calculateProjectCost(
  projectId: string,
  startDate?: Date,
  endDate?: Date
): Promise<number> {
  const logs = await getProjectUsageLogs(projectId, startDate, endDate);
  return logs.reduce((total, log) => total + (log.cost || 0), 0);
}

/**
 * Get cost breakdown by type for a project
 */
export async function getProjectCostBreakdown(
  projectId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  image: number;
  video: number;
  audio: number;
  text: number;
  total: number;
}> {
  const logs = await getProjectUsageLogs(projectId, startDate, endDate);
  
  const breakdown = {
    image: 0,
    video: 0,
    audio: 0,
    text: 0,
    total: 0
  };
  
  for (const log of logs) {
    const cost = log.cost || 0;
    breakdown.total += cost;
    
    if (log.type === 'image') breakdown.image += cost;
    else if (log.type === 'video') breakdown.video += cost;
    else if (log.type === 'audio') breakdown.audio += cost;
    else if (log.type === 'text') breakdown.text += cost;
  }
  
  return breakdown;
}

/**
 * Get usage statistics for a project
 */
export async function getProjectUsageStats(
  projectId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalCost: number;
  totalTokens: number;
  imageCount: number;
  videoCount: number;
  audioCount: number;
  textCount: number;
}> {
  const logs = await getProjectUsageLogs(projectId, startDate, endDate);
  
  const stats = {
    totalCost: 0,
    totalTokens: 0,
    imageCount: 0,
    videoCount: 0,
    audioCount: 0,
    textCount: 0
  };
  
  for (const log of logs) {
    stats.totalCost += log.cost || 0;
    stats.totalTokens += log.token_count || 0;
    
    if (log.type === 'image') stats.imageCount++;
    else if (log.type === 'video') stats.videoCount++;
    else if (log.type === 'audio') stats.audioCount++;
    else if (log.type === 'text') stats.textCount++;
  }
  
  return stats;
}
