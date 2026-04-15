import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export const validateBody = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.issues.map(e => ({
            path: e.path.join('.'),
            message: e.message
          }))
        });
      }
      next(error);
    }
  };
};

export const upscaleVideoSchema = z.object({
  videoUrl: z.string().url('Invalid video URL'),
  scale: z.number().min(1).max(4).optional().default(2)
});

export const videoProcessSchema = z.object({
  videoUrl: z.string().url('Invalid video URL'),
  type: z.enum(['trim', 'resize', 'convert', 'compress']),
  config: z.record(z.string(), z.any()).optional()
});

export const variationsSchema = z.object({
  imageUrl: z.string().url('Invalid image URL'),
  prompt: z.string().max(2000).optional(),
  count: z.number().int().min(1).max(8).optional().default(4),
  strength: z.number().min(0).max(1).optional()
});

export const inpaintSchema = z.object({
  imageUrl: z.string().url('Invalid image URL'),
  maskUrl: z.string().url('Invalid mask URL').optional(),
  prompt: z.string().max(2000).optional(),
  mode: z.enum(['inpaint', 'outpaint', 'edit']).optional()
});

export const styleTransferSchema = z.object({
  contentUrl: z.string().url('Invalid content URL'),
  styleUrl: z.string().url('Invalid style URL'),
  strength: z.number().min(0).max(1).optional(),
  preserveStructure: z.boolean().optional()
});

export const batchSizeSchema = z.object({
  imageUrl: z.string().url('Invalid image URL'),
  sizes: z.array(z.string()).min(1).max(10)
});

export const promptCreateSchema = z.object({
  text: z.string().min(1).max(5000, 'Prompt too long'),
  tags: z.array(z.string().max(50)).max(10).optional().default([])
});

export const interpolateSchema = z.object({
  videoUrl: z.string().url('Invalid video URL'),
  targetFps: z.number().int().min(24).max(120).optional().default(60),
  method: z.enum(['ffmpeg', 'rife']).optional()
});

export const proxyImageSchema = z.object({
  url: z.string().url('Invalid URL')
});

export const loginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(100)
});

export const uploadSchema = z.object({
  projectId: z.string().max(100).optional()
});
