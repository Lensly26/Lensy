import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync(new URL('../service-account.json', import.meta.url), 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function removeDarknessHub() {
  console.log("Searching for 'Darkness Hub' in guilds...");
  const guildsRef = db.collection('guilds');
  const snap = await guildsRef.get();
  
  let foundCount = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const name = data.name || "";
    if (name.toLowerCase() === "darkness hub") {
      console.log(`Found server: "${name}" (ID: ${doc.id})`);
      console.log(`Current isPublic: ${data.isPublic}, discoveryStatus: ${data.discoveryStatus}`);
      
      await guildsRef.doc(doc.id).update({
        isPublic: false,
        discoveryStatus: "NONE"
      });
      
      console.log(`Successfully updated: set isPublic = false, discoveryStatus = NONE`);
      foundCount++;
    }
  }
  
  if (foundCount === 0) {
    console.log("No servers matching 'Darkness Hub' were found in the database.");
  } else {
    console.log(`Successfully updated ${foundCount} server(s).`);
  }
}

removeDarknessHub().then(() => {
  setTimeout(() => process.exit(0), 1000);
}).catch(err => {
  console.error("Error removing Darkness Hub:", err);
  process.exit(1);
});
