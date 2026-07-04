import Stripe from "stripe";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { priceId, userId, successUrl, cancelUrl } = req.body;

  if (!priceId || !userId) {
    return res.status(400).json({ error: "Missing required fields: priceId and userId" });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;

  // Hybrid Mode: If Stripe Secret Key is missing, direct client to show its own mock payment input UI
  if (!secretKey || secretKey === "mock" || secretKey.includes("insert_stripe_secret_key")) {
    console.log("Stripe Secret Key not configured. Falling back to client-side mock payment.");
    const baseUrl = req.headers.origin || "https://lensy-sigma.vercel.app";
    const mockUrl = `${baseUrl}/premium?mock_checkout=true&priceId=${priceId}&userId=${userId}`;
    return res.status(200).json({ url: mockUrl, isMock: true });
  }

  try {
    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: priceId.toLowerCase().includes("lifetime") ? "payment" : "subscription",
      metadata: {
        userId: userId,
        priceId: priceId,
      },
      success_url: successUrl || `${req.headers.origin || "https://lensy-sigma.vercel.app"}/profile?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${req.headers.origin || "https://lensy-sigma.vercel.app"}/premium`,
    });

    return res.status(200).json({ url: session.url, isMock: false });
  } catch (error) {
    console.error("Stripe Checkout Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
