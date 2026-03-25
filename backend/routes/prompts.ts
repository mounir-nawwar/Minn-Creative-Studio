import express from 'express';
import { db } from '../../src/firebase';
import { collection, addDoc, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';

const router = express.Router();

router.get('/', async (req: any, res: any) => {
  try {
    const promptsRef = collection(db, 'prompts');
    const q = query(promptsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const prompts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(prompts);
  } catch (err: any) {
    console.error('List Prompts Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req: any, res: any) => {
  const { text, tags } = req.body;
  try {
    const promptsRef = collection(db, 'prompts');
    const docRef = await addDoc(promptsRef, {
      text,
      tags: tags || [],
      createdAt: Timestamp.now()
    });
    res.json({ id: docRef.id, text, tags });
  } catch (err: any) {
    console.error('Save Prompt Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
