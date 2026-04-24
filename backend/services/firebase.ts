import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getStorage as getAdminStorage } from 'firebase-admin/storage';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { addWavHeader } from '../utils/audio.ts';
import firebaseConfig from '../../firebase-applet-config.json';

let adminApp: App | null = null;
let resolvedBucketName: string | null = null;
const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
const configBucketName = (process.env.FIREBASE_STORAGE_BUCKET || (firebaseConfig as any).storageBucket || '').replace('gs://', '').trim();

export function isAdminInitialized(): boolean {
  return adminApp !== null;
}

export function getStorageStatus() {
  return {
    adminInitialized: adminApp !== null,
    resolvedBucket: resolvedBucketName || 'not yet resolved',
    configBucket: configBucketName,
  };
}

export function initFirebaseAdmin(): void {
  if (getApps().length > 0) { adminApp = getApps()[0]; return; }
  if (!serviceAccountStr) { console.warn('⚠️  FIREBASE_SERVICE_ACCOUNT not set.'); return; }
  try {
    const sa = JSON.parse(serviceAccountStr);
    adminApp = initializeApp({ credential: cert(sa), storageBucket: configBucketName });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Firebase Admin init failed:', message);
  }
}

export async function getWorkingBucket() {
  if (resolvedBucketName) return getAdminStorage().bucket(resolvedBucketName);
  const storage = getAdminStorage();
  const sa = serviceAccountStr ? JSON.parse(serviceAccountStr) : null;
  const fallbacks = new Set<string>();
  for (const id of [sa?.project_id, (firebaseConfig as any).projectId].filter(Boolean)) {
    fallbacks.add(`${id}.appspot.com`);
    fallbacks.add(`${id}.firebasestorage.app`);
  }
  if (configBucketName) fallbacks.add(configBucketName);
  for (const name of fallbacks) {
    try {
      const bucket = storage.bucket(name);
      const [exists] = await bucket.exists();
      if (exists) { resolvedBucketName = name; return bucket; }
    } catch {}
  }
  try {
    const [buckets] = await (storage as any).getBuckets();
    if (buckets.length > 0) { resolvedBucketName = buckets[0].name; return buckets[0]; }
  } catch {}
  return storage.bucket();
}

export async function resolveImageUrls(contents: any): Promise<any> {
  const resolveParts = (parts: any[]) =>
    Promise.all(parts.map(async (part: any) => {
      if (!part._imageUrl) return part;
      const r = await fetch(part._imageUrl);
      if (!r.ok) throw new Error(`Image fetch failed: ${r.status}`);
      const buf = await r.arrayBuffer();
      return { inlineData: { data: Buffer.from(buf).toString('base64'), mimeType: r.headers.get('content-type') || 'image/jpeg' } };
    }));
  if (Array.isArray(contents)) return Promise.all(contents.map(async (c: any) => c?.parts ? { ...c, parts: await resolveParts(c.parts) } : c));
  if (contents?.parts) return { ...contents, parts: await resolveParts(contents.parts) };
  return contents;
}

export async function trackProjectCost(
  projectId: string,
  cost: number,
  metadata: {
    imageCount?: number;
    videoCount?: number;
    audioCount?: number;
    tokenCount?: number;
    type: 'image' | 'video' | 'audio' | 'text';
  }
): Promise<void> {
  if (!adminApp || cost <= 0) return;

  const firestore = getFirestore();
  const projectRef = firestore.collection('projects').doc(projectId);

  try {
    await firestore.runTransaction(async (tx) => {
      const doc = await tx.get(projectRef);
      if (!doc.exists) {
        console.warn(`[Cost] Project ${projectId} not found, skipping cost tracking`);
        return;
      }

      const updates: Record<string, any> = {
        'usage.totalCost': FieldValue.increment(cost),
        'usage.lastUpdated': FieldValue.serverTimestamp(),
      };

      if (metadata.type === 'image') {
        updates['usage.imageCost'] = FieldValue.increment(cost);
        if (metadata.imageCount) updates['usage.totalImages'] = FieldValue.increment(metadata.imageCount);
      } else if (metadata.type === 'video') {
        updates['usage.videoCost'] = FieldValue.increment(cost);
        if (metadata.videoCount) updates['usage.totalVideos'] = FieldValue.increment(metadata.videoCount);
      } else if (metadata.type === 'audio') {
        updates['usage.audioCost'] = FieldValue.increment(cost);
        if (metadata.audioCount) updates['usage.totalAudio'] = FieldValue.increment(metadata.audioCount);
      } else if (metadata.type === 'text') {
        updates['usage.textCost'] = FieldValue.increment(cost);
      }

      if (metadata.tokenCount) {
        updates['usage.totalTokens'] = FieldValue.increment(metadata.tokenCount);
      }

      tx.update(projectRef, updates);
    });

    console.log(`[Cost] $${cost.toFixed(4)} for ${metadata.type} · projectId=${projectId}`);
  } catch (e) {
    console.error('Cost tracking failed:', e);
  }
}

export async function uploadInlineData(parts: any[], projectId: string): Promise<any[]> {
  return Promise.all(parts.map(async (part: any, i: number) => {
    if (!part.inlineData?.data) return part;
    let { data, mimeType } = part.inlineData;
    let buf: Buffer = Buffer.from(data, 'base64');
    let ext = mimeType?.split('/')[1]?.split(';')[0] || 'bin';

    if (mimeType?.includes('audio/l16')) {
      const rateMatch = mimeType.match(/rate=(\d+)/);
      const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 24000;
      buf = addWavHeader(buf, sampleRate);
      mimeType = 'audio/wav';
      ext = 'wav';
    }

    const bucket = await getWorkingBucket();
    const dest = `projects/${projectId}/assets/${Date.now()}-${i}-generated.${ext}`;
    await bucket.file(dest).save(buf, { metadata: { contentType: mimeType }, public: true });
    const storageUrl = `https://storage.googleapis.com/${bucket.name}/${dest}`;
    console.log(`[Upload] ${Math.round(buf.byteLength / 1024)}KB → ${storageUrl}`);
    return { ...part, inlineData: { storageUrl, mimeType } };
  }));
}

// Auto-initialize on import
initFirebaseAdmin();
