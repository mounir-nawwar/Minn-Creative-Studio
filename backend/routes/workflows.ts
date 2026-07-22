/**
 * Workflows API Routes
 * Handles workflow CRUD operations
 */

import express from 'express';
import { workflows, projects, generateId } from '../services/database.ts';
import { authMiddleware } from '../services/auth.ts';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/workflows
 * Get all workflows for the authenticated user
 * Optional query param: projectId
 */
router.get('/', (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.query;
    
    let workflowList;
    if (projectId) {
      workflowList = workflows.findByProjectId(projectId as string);
    } else {
      workflowList = workflows.findByUserId(userId);
    }
    
    res.json(workflowList);
  } catch (error: any) {
    console.error('Error fetching workflows:', error);
    res.status(500).json({ error: 'Failed to fetch workflows' });
  }
});

/**
 * GET /api/workflows/:id
 * Get a single workflow by ID
 */
router.get('/:id', (req: any, res: any) => {
  try {
    const { id } = req.params;

    const workflow = workflows.findById(id);

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    // Shared workspace: any authenticated user may open any workflow

    res.json(workflow);
  } catch (error: any) {
    console.error('Error fetching workflow:', error);
    res.status(500).json({ error: 'Failed to fetch workflow' });
  }
});

/**
 * POST /api/workflows
 * Create a new workflow
 */
router.post('/', (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { projectId, name, nodes, edges } = req.body;
    
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    
    // Shared workspace: any authenticated user may create workflows in any project
    const project = projects.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Validate nodes and edges are arrays
    if (nodes !== undefined && !Array.isArray(nodes)) {
      return res.status(400).json({ error: 'Nodes must be an array' });
    }
    if (edges !== undefined && !Array.isArray(edges)) {
      return res.status(400).json({ error: 'Edges must be an array' });
    }
    
    const id = generateId();
    const workflow = workflows.create(
      id,
      projectId,
      userId,
      name || `Workflow ${new Date().toLocaleDateString()}`,
      nodes || [],
      edges || []
    );
    
    res.status(201).json(workflow);
  } catch (error: any) {
    console.error('Error creating workflow:', error);
    res.status(500).json({ error: 'Failed to create workflow' });
  }
});

/**
 * Last writer per workflow, for the canvas live-sync's self-echo suppression.
 * The canvas tags each auto-save with a random clientToken; the /version probe
 * echoes it back so the poller recognizes its own writes regardless of when the
 * PUT response arrives (fixes false "someone changed this" toasts).
 *
 * In-memory is safe: the app is a single pm2 process. A restart just empties it,
 * and the token is only trusted when it still matches the current updated_at, so
 * a stale/absent entry degrades to "treat as foreign" — never a false self-match.
 */
const lastWriter = new Map<string, { updatedAt: string; token: string | null }>();

/**
 * GET /api/workflows/:id/version
 * Cheap revision probe for the canvas's live sync: returns only the timestamp
 * (+ the last-writer token), so an open canvas can poll without pulling the whole
 * graph. Registered before /:id so "version" isn't eaten by it.
 */
router.get('/:id/version', (req: any, res: any) => {
  try {
    const row = workflows.findById(req.params.id);
    if (!row) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    // Only surface the token when it still corresponds to the current revision.
    // Writes that bypass this route (MCP graph tools, the headless runner) bump
    // updated_at without touching the map, so their changes read as foreign.
    const last = lastWriter.get(row.id);
    const token = last && last.updatedAt === row.updated_at ? last.token : null;
    res.json({ id: row.id, updatedAt: row.updated_at, token });
  } catch (error: any) {
    console.error('Error fetching workflow version:', error);
    res.status(500).json({ error: 'Failed to fetch workflow version' });
  }
});

/**
 * PUT /api/workflows/:id
 * Update a workflow (auto-save)
 */
router.put('/:id', (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { name, nodes, edges, clientToken } = req.body;

    const workflow = workflows.findById(id);

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    // Shared workspace: any authenticated user may update any workflow (auto-save)

    // Validate nodes and edges if provided
    if (nodes !== undefined && !Array.isArray(nodes)) {
      return res.status(400).json({ error: 'Nodes must be an array' });
    }
    if (edges !== undefined && !Array.isArray(edges)) {
      return res.status(400).json({ error: 'Edges must be an array' });
    }

    workflows.update(id, { name, nodes, edges });
    const updated = workflows.findById(id);
    // Record who wrote this revision, synchronously with the write, so a poll
    // that observes the new updated_at also sees the writer's token.
    lastWriter.set(id, { updatedAt: updated.updated_at, token: typeof clientToken === 'string' ? clientToken : null });

    res.json(updated);
  } catch (error: any) {
    console.error('Error updating workflow:', error);
    res.status(500).json({ error: 'Failed to update workflow' });
  }
});

/**
 * DELETE /api/workflows/:id
 * Delete a workflow
 */
router.delete('/:id', (req: any, res: any) => {
  try {
    const { id } = req.params;

    const workflow = workflows.findById(id);

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    // Shared workspace: any authenticated user may delete any workflow

    workflows.delete(id);
    
    res.json({ success: true, message: 'Workflow deleted' });
  } catch (error: any) {
    console.error('Error deleting workflow:', error);
    res.status(500).json({ error: 'Failed to delete workflow' });
  }
});

export default router;
