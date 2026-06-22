import express from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.ts';
import { uploadFile } from '../services/storage.ts';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'video/mp4', 'video/webm', 'video/quicktime',
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm',
  'application/pdf',
]);

router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });

  if (!ALLOWED_MIME_TYPES.has(req.file.mimetype)) {
    return res.status(400).json({
      error: `Invalid file type: ${req.file.mimetype}. Allowed types: images, videos, audio, PDF`,
    });
  }

  try {
    const result = await uploadFile(
      req.body.projectId || 'default',
      req.user!.id,
      {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      }
    );
    return res.json({
      success: true,
      url: result.url,
      fileName: result.storagePath,
      id: result.id,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

export default router;
