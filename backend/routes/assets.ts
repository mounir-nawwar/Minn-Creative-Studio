/**
 * Assets API Routes
 * Handles file upload and asset management
 */

import express from 'express';
import multer from 'multer';
import { assets, projects, generateId } from '../services/database.ts';
import { authMiddleware } from '../services/auth.ts';
import { uploadFile, uploadBase64, uploadFromUrl, deleteFile, moveAssetToProject, ALLOWED_MIME_TYPES } from '../services/storage.ts';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max
  },
  fileFilter: (_req, file, cb) => {
    // Validate MIME type from multer
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
    }
  }
});

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/assets
 * Get all assets for a project
 * Query params: projectId, type
 */
router.get('/', async (req: any, res: any) => {
  try {
    const { projectId, type } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    // Shared workspace: any authenticated user may view any project's assets
    const project = projects.findById(projectId as string);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const assetList = assets.findByProjectId(projectId as string, type as string);
    res.json(assetList);
  } catch (error: any) {
    console.error('Error fetching assets:', error);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

/**
 * GET /api/assets/all
 * Global library: every asset across all projects (incl. playground).
 * Registered before /:id so "all" isn't captured as an asset id.
 * Query params: type, projectId, q, limit, offset
 */
router.get('/all', async (req: any, res: any) => {
  try {
    const { type, projectId, q, limit, offset } = req.query;
    const assetList = assets.findAllWithProject({
      type: type as string | undefined,
      projectId: projectId as string | undefined,
      search: q as string | undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    res.json(assetList);
  } catch (error: any) {
    console.error('Error fetching library assets:', error);
    res.status(500).json({ error: 'Failed to fetch library assets' });
  }
});

/**
 * GET /api/assets/:id
 * Get a single asset
 */
router.get('/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const asset = assets.findById(id);

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    res.json(asset);
  } catch (error: any) {
    console.error('Error fetching asset:', error);
    res.status(500).json({ error: 'Failed to fetch asset' });
  }
});

/**
 * POST /api/assets/upload
 * Upload a file
 */
router.post('/upload', upload.single('file'), async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { projectId, workflowId, nodeId, metadata } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    
    // Shared workspace: any authenticated user may write to any project
    const project = projects.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const result = await uploadFile(projectId, userId, {
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    }, {
      workflowId,
      nodeId,
      metadata: metadata ? JSON.parse(metadata) : undefined
    });
    
    res.status(201).json(result);
  } catch (error: any) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: error.message || 'Failed to upload file' });
  }
});

/**
 * POST /api/assets/base64
 * Upload base64 encoded data
 */
router.post('/base64', async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { projectId, workflowId, nodeId, base64, mimeType, filename, metadata } = req.body;
    
    if (!base64 || !mimeType) {
      return res.status(400).json({ error: 'Base64 data and mime type are required' });
    }
    
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    
    // Shared workspace: any authenticated user may write to any project
    const project = projects.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const result = await uploadBase64(projectId, userId, {
      base64,
      mimeType,
      filename
    }, {
      workflowId,
      nodeId,
      metadata
    });
    
    res.status(201).json(result);
  } catch (error: any) {
    console.error('Error uploading base64:', error);
    res.status(500).json({ error: error.message || 'Failed to upload data' });
  }
});

/**
 * POST /api/assets/url
 * Upload from URL (includes SSRF protection via storage service)
 */
router.post('/url', async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { projectId, workflowId, nodeId, url, metadata } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    
    // Shared workspace: any authenticated user may write to any project
    const project = projects.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // storage.uploadFromUrl already includes comprehensive SSRF protection
    const result = await uploadFromUrl(projectId, userId, url, {
      workflowId,
      nodeId,
      metadata
    });
    
    res.status(201).json(result);
  } catch (error: any) {
    console.error('Error uploading from URL:', error);
    // Return user-friendly error messages
    if (error.message?.includes('blocked')) {
      res.status(400).json({ error: 'This URL is not allowed' });
    } else {
      res.status(500).json({ error: error.message || 'Failed to fetch URL' });
    }
  }
});

/**
 * PATCH /api/assets/:id/move
 * Move an asset (file + record) into another project
 */
router.patch('/:id/move', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { targetProjectId } = req.body;

    if (!targetProjectId || typeof targetProjectId !== 'string') {
      return res.status(400).json({ error: 'targetProjectId is required' });
    }

    const moved = await moveAssetToProject(id, targetProjectId);
    res.json(moved);
  } catch (error: any) {
    console.error('Error moving asset:', error);
    if (error.message === 'Asset not found') {
      return res.status(404).json({ error: 'Asset not found' });
    }
    if (error.message === 'Target project not found') {
      return res.status(400).json({ error: 'Target project not found' });
    }
    res.status(500).json({ error: error.message || 'Failed to move asset' });
  }
});

/**
 * DELETE /api/assets/:id
 * Delete an asset
 */
router.delete('/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const result = await deleteFile(id, userId);
    
    if (!result) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    
    res.json({ success: true, message: 'Asset deleted' });
  } catch (error: any) {
    console.error('Error deleting asset:', error);
    if (error.message?.includes('Access denied')) {
      res.status(403).json({ error: 'Access denied' });
    } else {
      res.status(500).json({ error: error.message || 'Failed to delete asset' });
    }
  }
});

export default router;
