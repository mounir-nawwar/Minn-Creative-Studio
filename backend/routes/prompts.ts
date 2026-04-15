import express from 'express';
import { db } from '../../src/firebase';
import { collection, addDoc, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { requireAuth } from '../middleware/auth.ts';
import { validateBody, promptCreateSchema } from '../middleware/validation.ts';

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const promptsRef = collection(db, 'prompts');
    const q = query(promptsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const prompts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(prompts);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('List Prompts Error:', err);
    res.status(500).json({ error: message });
  }
});

router.post('/', requireAuth, validateBody(promptCreateSchema), async (req, res) => {
  const { text, tags } = req.body;
  try {
    const promptsRef = collection(db, 'prompts');
    const docRef = await addDoc(promptsRef, {
      text,
      tags: tags || [],
      createdAt: Timestamp.now()
    });
    res.json({ id: docRef.id, text, tags });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Save Prompt Error:', err);
    res.status(500).json({ error: message });
  }
});

export default router;
