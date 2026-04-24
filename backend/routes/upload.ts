import express from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.ts';
import { getWorkingBucket, isAdminInitialized } from '../services/firebase.ts';

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
    if (!isAdminInitialized()) throw new Error('Firebase Admin is not initialized.');
    const bucket = await getWorkingBucket();
    const destination = `projects/${req.body.projectId || 'default'}/assets/${Date.now()}-${req.file.originalname}`;
    await bucket.file(destination).save(req.file.buffer, { metadata: { contentType: req.file.mimetype }, public: true });
    return res.json({
      success: true,
      url: `https://storage.googleapis.com/${bucket.name}/${destination}`,
      fileName: destination,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const isBucketMissing = message.includes('does not exist') || (err as any)?.code === 404;
    return res.status(500).json({
      error: isBucketMissing
        ? 'Firebase Storage bucket not found. Enable it in Firebase Console: Build → Storage → Get Started.'
        : message,
    });
  }
});

export default router;
