import Stripe from "stripe";
import admin from "firebase-admin";
import fs from "fs";
import path from "path";

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
  try {
    const saPath = path.resolve(process.cwd(), "service-account.json");
    if (fs.existsSync(saPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(saPath, "utf8"));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log("Firebase Admin initialized via service-account.json in API Webhook");
    } else {
      admin.initializeApp();
      console.log("Firebase Admin initialized via default credentials in API Webhook");
    }
  } catch (e) {
    console.error("Firebase Admin initialization error:", e);
  }
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey) {
    return res.status(500).json({ error: "Stripe Secret Key is not configured." });
  }

  const stripe = new Stripe(secretKey);
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    const rawBody = await getRawBody(req);
    
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } else {
      // Trust event payload directly if secret is not set (e.g. testing or local webhooks without key)
      event = JSON.parse(rawBody.toString());
    }
  } catch (err) {
    console.error(`Stripe Webhook Signature Verification Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Upgrade user in Firestore on checkout session completion
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata?.userId;
    const priceId = session.metadata?.priceId;

    if (userId) {
      try {
        await db.collection("users").doc(userId).update({
          isPremium: true,
          premiumPlan: priceId || "stripe_upgrade",
          premiumSince: admin.firestore.FieldValue.serverTimestamp(),
          premiumPaymentName: session.customer_details?.name || "Stripe Premium User",
          premiumPaymentLast4: session.payment_intent ? "Stripe Checkout" : "Card"
        });
        console.log(`Stripe Webhook successfully upgraded user ${userId} to Premium.`);
      } catch (dbErr) {
        console.error("Firestore database update failed inside webhook:", dbErr);
        return res.status(500).send("Database upgrade failed");
      }
    } else {
      console.warn("Stripe Checkout completed event lacks userId metadata");
    }
  }

  return res.status(200).json({ received: true });
}

// Read raw body stream
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", (err) => reject(err));
  });
}

// Disable body parsing so raw body can be validated by Stripe signature sdk
export const config = {
  api: {
    bodyParser: false,
  },
};
