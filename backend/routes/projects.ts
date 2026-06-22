/**
 * Projects API Routes
 * Handles project CRUD operations
 */

import express from 'express';
import { projects, generateId, usageLogs } from '../services/database.ts';
import { authMiddleware } from '../services/auth.ts';
import { deleteProjectFiles } from '../services/storage.ts';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/projects
 * Shared workspace — returns every project to any authenticated user.
 * The frontend flags projects created by the other account as "shared".
 */
router.get('/', (_req: any, res: any) => {
  try {
    const projectList = projects.findAll();
    res.json(projectList);
  } catch (error: any) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

/**
 * GET /api/projects/:id
 * Get a single project by ID
 */
router.get('/:id', (req: any, res: any) => {
  try {
    const { id } = req.params;

    const project = projects.findById(id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Shared workspace — any authenticated user may open any project.
    res.json(project);
  } catch (error: any) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

/**
 * POST /api/projects
 * Create a new project
 */
router.post('/', (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { name, description, settings } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }
    
    const id = generateId();
    const project = projects.create(id, userId, name, description, settings);
    
    res.status(201).json(project);
  } catch (error: any) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

/**
 * PUT /api/projects/:id
 * Update a project
 */
router.put('/:id', (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { name, description, settings, usage } = req.body;

    const project = projects.findById(id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Shared workspace — any authenticated user may edit any project.
    projects.update(id, { name, description, settings, usage });
    const updated = projects.findById(id);
    
    res.json(updated);
  } catch (error: any) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

/**
 * DELETE /api/projects/:id
 * Delete a project and all its files
 */
router.delete('/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const project = projects.findById(id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Shared workspace — any authenticated user may delete any project.
    // Delete all project files
    await deleteProjectFiles(id);
    
    // Delete project from database
    projects.delete(id);
    
    res.json({ success: true, message: 'Project deleted' });
  } catch (error: any) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

/**
 * GET /api/projects/:id/usage
 * Get usage logs for a project
 */
router.get('/:id/usage', (req: any, res: any) => {
  try {
    const { id } = req.params;

    const project = projects.findById(id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Shared workspace — usage is visible to any authenticated user.
    const logs = usageLogs.getByProjectId(id);
    res.json(logs);
  } catch (error: any) {
    console.error('Error fetching usage:', error);
    res.status(500).json({ error: 'Failed to fetch usage logs' });
  }
});

export default router;
