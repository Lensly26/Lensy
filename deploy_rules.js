import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync(new URL('./service-account.json', import.meta.url), 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function deployRules() {
  console.log("Reading rules file...");
  const rules = readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8');
  console.log("Deploying firestore rules...");
  await admin.securityRules().releaseFirestoreRulesetFromSource(rules);
  console.log("Firestore rules deployed successfully!");
}

deployRules().catch(err => {
  console.error("Failed to deploy rules:", err);
  process.exit(1);
});
