// Migration script: copies Firestore data + Storage files from old project to new
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import https from 'https';
import fs from 'fs';

const OLD_SA = {
  "type": "service_account",
  "project_id": "gen-lang-client-0046544084",
  "private_key_id": "95a2ee2f0112e93beebc77d8362ab82f862b5d7b",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCX0CitkRIGMwdX\npL79phN14rcc98f5qYQ5NbYNDNL73hb/wS3/yeLvpbuSkwhi7X/gxKZTQDJhFFnl\nFfg+d1jAsEHTVTTUbbPT3T1JYjNyQ3A9FuXtmhh6Y/b1OSFLofyvXFG0hCx9ycTB\nYGaJ8hBz920I/k8Gz1DCmQF1E5ufMfy67hlvw725g9HKbdGpBalyl4JS99VfjIpV\n8hA/zjFNMr0QhhqoTXRWWNr7eCnh7+bPbTXIvhnqNAhjqrK/7PBfbqJeNRJG4vcI\ndtaP8Sel4RlXKO+yGkUzJw9IiuOfngHxUo+Q0/yKzCJqS4cROL0mozqeJi0eyM7E\nkv7l78aNAgMBAAECggEAEGEIPn+wHOSdBm7zHz0vjNC21mSCWhSYvC5oE5zeV4fE\n3fea7aW7uwTbyarc5QWAPkEhO8qplNFECKQX6i9orzNlCra+8ita00Ejp1r1t36A\nqcqiaIHvYacO4jK1fao+r7HLa+k1vqWJ+Z4bugbYkRZxGF8NqiusaC5nWpkQuXpZ\n4FfBK6SFWFTaxOgrIGEBGOkkPEl8i9k3vo4tlyDqMCDke9DLn7J3uPPs5Jfvbn5C\n/twZdk0ECd7tjLyVYPKzISy0HeJ/07nNKZI1POkVYjmOX2TYZGhJIDCvyVrO34fz\nsg8nzEGuVFKqN5QvxesLqme9lRLUZwp2jpel84EiKQKBgQDJWtQEZAXQOK/GEjSi\nsat1NIRsr2ES7ZgO0nHAgcuPFM2JedNbiz/v3Vj4ma+qTidMWNaCSHc+tpUpsxRE\njkeDHIDcfF00Zqh9CNrVbBgIgZIvQ+luUPd0NX4VyttjEmk9pvJThNt4CGCuBUP8\nvPeQnH22AbfjjM+hB5YAYq5JFQKBgQDBA2k8afynemUEmtX4W4mLKng8xUwXfR+3\nr7X/vC6FeLhztcnkobcpRh3N/2IEjbijHKjrQtrewP7FpdIaGwPSHcwLyrQmv9jV\nml2MPw3RMHUW6uFOcn/IJgbkeOA3qqy3ZqYUg3e/6dmZcTBeDhhLgZQLdxQ30Ovl\nkdLpq8H1mQKBgQCzxKrLrL1f9GxCK5jgtD0+6/9axY2mh4ednBdA5uDlQo5qseCY\nt48CyR0Y/qVOKG5/hEUnlikYTYyI6UAsINcJ4JXPxBy2nvzIfPJbXyFp3ry0BC7R\ndeonz2ZdcHpETni1OWraVCBZXylp1HupltB0RLMbnxcdSmdI/mvWtkOiLQKBgANV\nd7/fZMnPx2bo9cEwc5O/zAvgrIvLUXzuwAoGyhbsGuOExFP6pxtDZshkHOFPQV0v\n5YsKwJUQaFYpoxNoXAyJDzk06x+wOKKX4/3EKQzv9VXMANBGEgb3AS95FwZfIFSa\npUu9aZgbBfMsjVVSkQDc4B3ClMrSBQEWH7qBiPwhAoGBAL5CThnvVi8/fxQQPHdY\nfB/P9UjlgKPZCunI7/qecBnBy4Ot+HEi6hj5oDnYgZyg1q08n2tqhwgtT8hB9g2D\n74KmUVpM3ZxAuEzq+Rp68Au63ORQ89vWMckkJqABjsQnXi3oK4t4qdf8xhG988So\n9hsbAgs3xNovZHscdQo+bDEx\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@gen-lang-client-0046544084.iam.gserviceaccount.com",
  "client_id": "112330323554594907777",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40gen-lang-client-0046544084.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

const NEW_SA = {
  "type": "service_account",
  "project_id": "gen-lang-client-0639313445",
  "private_key_id": "bd5d184ea6287ccde7b6b41d8445b411810ac7f0",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDfUKx6lxJBjo/n\n90HAq/hVZ5vDEoWtoF3AE4ffMbARSAZJDGZeQMe4ygw5zD8n959RQYkFsfKlsA0w\nhpKqjv9/ax00KQnTx0EuQdwqBRLa8oXULmGapXGxZr5qJZFII0nwagSBB97L0ryU\nx4BnDfbphkAWzAD4uwHUokQUFmLgk2UQOUIeWCloqHrDSLGeyDlNkxPo2COF0nGK\nKpgeL96kuXFTB1JlH6wt+SD1v1bJqOs11TkUrjGG/+2p9U9G+b0X/1OWJRV6yPlL\nKgz/sVhEeUv9+xgw9R3Qlq+Rm6WAn/XhNeWxUfJrXkNsgYvpVM2X72X9uJS8jlgR\nLMkKluVRAgMBAAECggEADjoLqvRZ547yBbiqWeB60ydlHyHcc1Runzsp96L+O7Oc\nzDrmgKWxiPO89f0C9Fm3BCG1MtrZ1wq8DwsxEn2cCF2QwDnHFFSy3IQPRyazQ1Ca\nYbX3ZjdDuCYQBnTQkx8bFEkPcrryINu9mOA22Bnl0OMfzR6qXIOUGRxMqFeewqjI\nGsYNUmVIvUU0OATSfNztYmPHmWaJzpD/q3y4f5AkqeXGO79nFeoFxkXS+NWwAldk\njwaEq2Rtyvta4nTnnQCAbxDapBWBJw4Yo39N4A8levpDAJn1N3DTKqxYOc8uMJj4\nN1+Ug/dDGCLe9eI2EHeCkmQYQKaE2Az8CD/9FFSMawKBgQDxv+7eUeu9eF7zuZSD\nxo+QSiltOM5atUnvBagjqGlw/UjLFVc7Gug+R2wUVvgk5UnpkIYp5yf3BcahcyKQ\ns2oHzo2pHIJQb3tGoardW/dQKq51AdnMAfTz8jdjw6RLZl3WZjG26Pm5Be7jhf9r\njpXy/mfdKtofAe0khKWqGTXZGwKBgQDseo7AB5NhBW8id8BZhSexBBO9SAeLP3v6\nFSNDr+SaEGJiuL+vdt4aMqWfH1sd0eQDy/kvnnCfxZdSdZooHYXpc5cwLRXfu6FE\nuptwjL4TdPPpaxzNVudlXVrQ64aYCLZjMSovMuH5hcVFWH4P9lZ5HXVtc7ZHTJR2\nlRm0Y3+uAwKBgGE0u+fJKPFWpVd7F6yk+rUaHO4+GTuACeqCa8lqvnsgXVTLj/fE\nKf5g2aSUE9NCHyY7ZrcSq484U1Y35X4ppkjdVTjarcuKCBeuifXYNOmXP+7sf5b4\ncnZkvsDuufFXiAPds7/IjiFHsXbrOnkVLFY41aqowGwXajN04ugymuRhAoGBAJPV\nQixWEBJVHVbE2iCcl2WYEOcBgoXQmCaM1FDaQuT1XSwuJtcATnS+OL+zEHkh35No\nDk1wlSOsmJ7aGhb97ds1gcyCQuxtFbIrnkTMF39+W4UOiyDrNRkvNTjqJGgi+jIk\naCS9gHtG3z4sxhIgg4qPmftknQ0RmLZRG5KjqQwVAoGAJkoRGC8MQpxKXpQebxM/\n1bqjVt5dFnmY5R7JwVu6BF4+XmYXexHUzCYmyZkEb357F0TvyHI0XW+gh3MiaSHF\n529ZZMzrkEKGBK1cLGLPlOOMspc4YoxHmFmNrwQ0XcoY499h0SyEr8nbGMthImqR\neVQhe1b31Ij8a88WXt35kDY=\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@gen-lang-client-0639313445.iam.gserviceaccount.com",
  "client_id": "103868540030765581681",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40gen-lang-client-0639313445.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

const oldApp = initializeApp({ credential: cert(OLD_SA), storageBucket: 'gen-lang-client-0046544084.firebasestorage.app' }, 'old');
const newApp = initializeApp({ credential: cert(NEW_SA), storageBucket: 'gen-lang-client-0639313445.firebasestorage.app' }, 'new');

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
