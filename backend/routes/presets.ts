/**
 * Chat Presets API Routes
 * Reusable system-instruction templates for Chat Studio.
 * Shared workspace: presets are visible and editable by both users.
 */

import express from 'express';
import { chatPresets, generateId } from '../services/database.ts';
import { authMiddleware } from '../services/auth.ts';

const router = express.Router();

router.use(authMiddleware);

const DEFAULT_PRESETS: { name: string; systemInstruction: string }[] = [
  {
    name: 'Creative director',
    systemInstruction:
      'You are a creative director assistant for AI video/image generation. You specialize in writing detailed generative prompts for Midjourney, Stable Diffusion, Sora, Runway, Kling, and similar tools. When asked for prompts, write complete, rich, detailed prompts with specific visual descriptions. Help with visual ideas, camera directions, lighting setups, style references, color palettes, and technical advice. Wrap any prompt in a fenced code block (triple backticks) so it renders as a copyable block.\n\nIMPORTANT: Match your response length to what was asked. Casual messages get short natural replies. Only go detailed when the user explicitly asks for prompts, ideas, or guidance. Never volunteer unsolicited project analysis or example prompts.',
  },
  {
    name: 'IG caption writer',
    systemInstruction:
      'You write Instagram captions for agency client accounts. Given a description of the post (or an attached image), produce 2-3 caption options: one short and punchy, one storytelling, one with a question or CTA. Match the brand tone from the project context when available. Include a tight set of 5-8 relevant hashtags on a separate line. Never use clichés like "Living my best life". Keep emojis minimal and intentional.',
  },
  {
    name: 'Try-on prompt builder',
    systemInstruction:
      'You build image-generation prompts for virtual clothing try-on and product-on-model shots. Given a garment or product description (and any attached reference images), write a precise prompt describing: the model (pose, framing, expression kept neutral unless asked), the garment with fabric/fit/color details, studio or lifestyle setting, lighting setup, and camera lens/angle. Preserve the exact garment design — call out details that must not change. Wrap the final prompt in a fenced code block.',
  },
];

/**
 * GET /api/presets
 * List all presets; seeds the defaults on first ever call.
 */
router.get('/', (req: any, res: any) => {
  try {
    let presets = chatPresets.findAll();
    if (presets.length === 0) {
      for (const preset of DEFAULT_PRESETS) {
        chatPresets.create(generateId(), req.user.id, preset.name, preset.systemInstruction);
      }
      presets = chatPresets.findAll();
    }
    res.json(presets);
  } catch (error: any) {
    console.error('Error fetching presets:', error);
    res.status(500).json({ error: 'Failed to fetch presets' });
  }
});

/**
 * POST /api/presets
 * Create a preset
 */
router.post('/', (req: any, res: any) => {
  try {
    const { name, systemInstruction } = req.body;

    if (!name || typeof name !== 'string' || !systemInstruction || typeof systemInstruction !== 'string') {
      return res.status(400).json({ error: 'Name and systemInstruction are required' });
    }

    const preset = chatPresets.create(generateId(), req.user.id, name.trim(), systemInstruction);
    res.status(201).json(preset);
  } catch (error: any) {
    console.error('Error creating preset:', error);
    res.status(500).json({ error: 'Failed to create preset' });
  }
});

/**
 * PUT /api/presets/:id
 * Update a preset (shared workspace: any authenticated user)
 */
router.put('/:id', (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { name, systemInstruction } = req.body;

    const preset = chatPresets.findById(id);
    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    chatPresets.update(id, { name, systemInstruction });
    res.json(chatPresets.findById(id));
  } catch (error: any) {
    console.error('Error updating preset:', error);
    res.status(500).json({ error: 'Failed to update preset' });
  }
});

/**
 * DELETE /api/presets/:id
 * Delete a preset (shared workspace: any authenticated user)
 */
router.delete('/:id', (req: any, res: any) => {
  try {
    const { id } = req.params;

    const preset = chatPresets.findById(id);
    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    chatPresets.delete(id);
    res.json({ success: true, message: 'Preset deleted' });
  } catch (error: any) {
    console.error('Error deleting preset:', error);
    res.status(500).json({ error: 'Failed to delete preset' });
  }
});

export default router;
