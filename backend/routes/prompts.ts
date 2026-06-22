import express from 'express';
import { prompts, generateId } from '../services/database.ts';
import { requireAuth } from '../middleware/auth.ts';
import { validateBody, promptCreateSchema } from '../middleware/validation.ts';

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const promptList = prompts.getAll(userId);
    res.json(promptList);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('List Prompts Error:', err);
    res.status(500).json({ error: message });
  }
});

router.post('/', requireAuth, validateBody(promptCreateSchema), async (req, res) => {
  const { text, tags } = req.body;
  const userId = req.user?.id;
  try {
    const id = generateId();
    const newPrompt = prompts.create(id, userId, text, tags);
    res.json(newPrompt);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Save Prompt Error:', err);
    res.status(500).json({ error: message });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const prompt = prompts.getById(req.params.id);
    if (!prompt) {
      res.status(404).json({ error: 'Prompt not found' });
      return;
    }
    res.json(prompt);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Get Prompt Error:', err);
    res.status(500).json({ error: message });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  const { text, tags } = req.body;
  try {
    const existingPrompt = prompts.getById(req.params.id);
    if (!existingPrompt) {
      res.status(404).json({ error: 'Prompt not found' });
      return;
    }
    prompts.update(req.params.id, { text, tags });
    const updatedPrompt = prompts.getById(req.params.id);
    res.json(updatedPrompt);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Update Prompt Error:', err);
    res.status(500).json({ error: message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const existingPrompt = prompts.getById(req.params.id);
    if (!existingPrompt) {
      res.status(404).json({ error: 'Prompt not found' });
      return;
    }
    prompts.delete(req.params.id);
    res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Delete Prompt Error:', err);
    res.status(500).json({ error: message });
  }
});

export default router;
