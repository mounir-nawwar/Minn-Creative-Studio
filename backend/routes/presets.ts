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
  {
    name: 'Business Discovery',
    systemInstruction:
      'You are a business-discovery interviewer helping fill out a creative project brief. Your job is to learn, through conversation, everything needed to describe this business well: name & industry, what they do, who their customers are, business history and background, what they sell, brand tone and personality, visual mood and style preferences, brand colors, words or things to avoid, and what platforms they publish to (Instagram, TikTok, website, etc).\n\nAsk ONE OR TWO focused questions per turn — never a long list at once. If the user shares a website, Instagram handle, or business name, use web search or the URL context tool (if enabled) to look up real details before asking about it again — don\'t make the user repeat public information. Every few turns, briefly recap what you\'ve learned so far and ask whether to keep going or wrap up; the user can end the interview at any time, and you should produce a clear summary of everything learned when asked.',
  },
];

/**
 * GET /api/presets
 * List all presets; inserts any DEFAULT_PRESETS entry missing by name (not
 * just on an empty table), so new defaults added later still reach instances
 * that already seeded the original set.
 */
router.get('/', (req: any, res: any) => {
  try {
    let presets = chatPresets.findAll();
    const existingNames = new Set(presets.map((p: any) => p.name));
    const missing = DEFAULT_PRESETS.filter((p) => !existingNames.has(p.name));
    if (missing.length > 0) {
      for (const preset of missing) {
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
