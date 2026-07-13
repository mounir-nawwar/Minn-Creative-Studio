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
 * GET /api/workflows/:id/version
 * Cheap revision probe for the canvas's live sync: returns only the timestamp,
 * so an open canvas can poll without pulling the whole graph (node data can
 * carry large outputs). Registered before /:id so "version" isn't eaten by it.
 */
router.get('/:id/version', (req: any, res: any) => {
  try {
    const row = workflows.findById(req.params.id);
    if (!row) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    res.json({ id: row.id, updatedAt: row.updated_at });
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
    const { name, nodes, edges } = req.body;

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
