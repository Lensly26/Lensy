import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

const serviceAccount = JSON.parse(fs.readFileSync("./service-account.json", "utf8"));

if (global.adminApp === undefined) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}

const db = getFirestore();

async function run() {
  console.log("Inspecting users collection:");
  const snap = await db.collection("users").limit(3).get();
  snap.forEach(docSnap => {
    const data = docSnap.data();
    console.log(`- User ID: ${docSnap.id}`);
    console.log(`  Username: "${data.username}", DisplayName: "${data.displayName}", Email: "${data.email || "undefined"}", Role: "${data.role || "undefined"}"`);
  });

  console.log("\nInspecting tickets collection:");
  const ticketsSnap = await db.collection("tickets").limit(3).get();
  ticketsSnap.forEach(docSnap => {
    const data = docSnap.data();
    console.log(`- Ticket ID: ${docSnap.id}`);
    console.log(`  AuthorId: "${data.authorId}", Subject: "${data.subject}", Status: "${data.status}"`);
  });
}

run().catch(console.error);
