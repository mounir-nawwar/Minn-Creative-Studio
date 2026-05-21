// Migration script: copies Firestore data + Storage files from old project to new
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import https from 'https';

// Remove hardcoded constants

const oldApp = initializeApp({
  storageBucket: 'gen-lang-client-0046544084.firebasestorage.app'
  // Credentials for 'old' will be picked up from GOOGLE_APPLICATION_CREDENTIALS_OLD
}, 'old');

const newApp = initializeApp({
  // Credentials for 'new' will be picked up from GOOGLE_APPLICATION_CREDENTIALS_NEW
  storageBucket: 'gen-lang-client-0639313445.firebasestorage.app'
}, 'new');

const oldDb = getFirestore(oldApp, 'ai-studio-3ada0e30-1a9e-475f-97a0-3c170fdc5bb2');
const newDb = getFirestore(newApp);
const oldBucket = getStorage(oldApp).bucket();
const newBucket = getStorage(newApp).bucket();

async function migrateCollection(collectionPath) {
  const snap = await oldDb.collection(collectionPath).get();
  if (snap.empty) { console.log(`  (empty) ${collectionPath}`); return; }
  for (const docSnap of snap.docs) {
    await newDb.collection(collectionPath).doc(docSnap.id).set(docSnap.data());
    // Recurse into subcollections
    const subcollections = await docSnap.ref.listCollections();
    for (const sub of subcollections) {
      await migrateCollection(`${collectionPath}/${docSnap.id}/${sub.id}`);
    }
    process.stdout.write('.');
  }
  console.log(`\n  ✓ ${collectionPath} (${snap.size} docs)`);
}

async function migrateStorage() {
  const [files] = await oldBucket.getFiles();
  if (files.length === 0) { console.log('  (no files in storage)'); return; }
  for (const file of files) {
    const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 60 * 60 * 1000 });
    const destFile = newBucket.file(file.name);
    await new Promise((resolve, reject) => {
      https.get(url, (res) => {
        const stream = destFile.createWriteStream({ metadata: { contentType: res.headers['content-type'] } });
        res.pipe(stream);
        stream.on('finish', resolve);
        stream.on('error', reject);
      }).on('error', reject);
    });
    console.log(`  ✓ ${file.name}`);
  }
}

async function main() {
  console.log('=== Firestore Migration ===');
  const collections = await oldDb.listCollections();
  for (const col of collections) {
    await migrateCollection(col.id);
  }

  console.log('\n=== Storage Migration ===');
  await migrateStorage();

  console.log('\n✅ Migration complete!');
}

main().catch(console.error);
