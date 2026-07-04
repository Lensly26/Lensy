import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../lib/auth-store.js";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "../lib/firebase.js";

const PLANS = [
  {
    id: "monthly",
    name: "Monthly",
    price: "$4.99",
    priceNum: 4.99,
    period: "/mo",
    desc: "Perfect for trying out Premium features",
    badge: null,
    features: [
      "Animated GIF Avatars",
      "Custom Profile Banner",
      "Premium Badge",
      "Priority Support",
      "Extended Upload Limit (25 MB)",
    ],
  },
  {
    id: "yearly",
    name: "Yearly",
    price: "$39.99",
    priceNum: 39.99,
    period: "/yr",
    desc: "Save 33% — best value",
    badge: "BEST VALUE",
    features: [
      "Everything in Monthly",
      "Exclusive Yearly Badge",
      "Early Access to New Features",
      "Custom Themes (Coming Soon)",
      "Animated Server Icons",
      "2× Upload Limit (50 MB)",
    ],
  },
  {
    id: "lifetime",
    name: "Lifetime",
    price: "$99.99",
    priceNum: 99.99,
    period: "once",
    desc: "One payment, premium forever",
    badge: "FOREVER",
    features: [
      "Everything in Yearly",
      "Lifetime Premium Badge",
      "Founder Status",
      "All Future Features Included",
      "Priority Bug Fix Requests",
      "Direct Developer Access",
    ],
  },
];

export function PremiumPage() {
  const me = useAuthStore((s) => s.me);
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const navigate = useNavigate();
  
  const [selectedPlan, setSelectedPlan] = useState("yearly");
  const [processing, setProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Payment form state
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardZip, setCardZip] = useState("");

  const alreadyPremium = me?.isPremium === true;

  // Format card number with spaces every 4 digits
  const handleCardNumberChange = (value: string) => {
    const clean = value.replace(/\D/g, "").slice(0, 16);
    const formatted = clean.match(/.{1,4}/g)?.join(" ") || clean;
    setCardNumber(formatted);
  };

  // Format expiry MM/YY
  const handleExpiryChange = (value: string) => {
    const clean = value.replace(/\D/g, "").slice(0, 4);
    if (clean.length >= 3) {
      setCardExpiry(`${clean.slice(0, 2)}/${clean.slice(2)}`);
    } else {
      setCardExpiry(clean);
    }
  };

  const isFormValid =
    cardName.trim().length > 2 &&
    cardNumber.replace(/\s/g, "").length === 16 &&
    cardExpiry.length === 5 &&
    cardCvc.length >= 3 &&
    cardZip.trim().length >= 5;

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!me || !isFormValid) return;
    setProcessing(true);
    
    // Simulate real authorization and gateway processing
    await new Promise(resolve => setTimeout(resolve, 2200));
    
    try {
      await updateDoc(doc(db, "users", me.id), {
        isPremium: true,
        premiumPlan: selectedPlan,
        premiumSince: Timestamp.now(),
        // Save mock payment info
        premiumPaymentName: cardName,
        premiumPaymentLast4: cardNumber.slice(-4)
      });
      await refreshMe();
      setShowCheckout(false);
      setShowSuccess(true);
      // Reset form
      setCardName("");
      setCardNumber("");
      setCardExpiry("");
      setCardCvc("");
      setCardZip("");
    } catch (err) {
      alert("Payment processing failed. Please try again. " + err);
    } finally {
      setProcessing(false);
    }
  };

  const handleDowngrade = async () => {
    if (!me) return;
    if (!confirm("Are you sure you want to cancel your Premium subscription? Your account will be downgraded to the free tier immediately.")) return;

    setCancelling(true);
    try {
      await updateDoc(doc(db, "users", me.id), {
        isPremium: false,
        premiumPlan: null,
        premiumSince: null,
        premiumPaymentName: null,
        premiumPaymentLast4: null
      });
      await refreshMe();
      alert("Your subscription has been cancelled and Tylerplayz was successfully downgraded.");
    } catch (err) {
      alert("Failed to downgrade: " + err);
    } finally {
      setCancelling(false);
    }
  };

  if (!me) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><div className="loader" /></div>;

  const activePlan = PLANS.find(p => p.id === selectedPlan) || PLANS[1];

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-deep)",
      fontFamily: "var(--font)",
      overflow: "auto",
    }}>
      {/* Ambient background */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-10%", left: "20%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(140,94,255,0.1) 0%, transparent 70%)", filter: "blur(60px)" }} />
        <div style={{ position: "absolute", bottom: "-5%", right: "15%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(79,124,255,0.08) 0%, transparent 70%)", filter: "blur(60px)" }} />
        <div style={{ position: "absolute", top: "40%", left: "60%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,94,173,0.06) 0%, transparent 70%)", filter: "blur(60px)" }} />
      </div>

      {/* Success Overlay */}
      {showSuccess && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            textAlign: "center", padding: 60,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 28, maxWidth: 440,
            boxShadow: "0 20px 50px rgba(0,0,0,0.5)"
          }}>
            <div style={{ fontSize: 64, marginBottom: 20 }}>🎉</div>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 8, background: "linear-gradient(135deg, #8C5EFF, #FF5EAD)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Welcome to Premium!
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>
              Your payment was authorized successfully. Tylerplayz is now upgraded to Premium!
            </p>
            <button onClick={() => { setShowSuccess(false); navigate("/profile"); }} style={{
              padding: "12px 32px", borderRadius: 12,
              background: "linear-gradient(135deg, #8C5EFF, #FF5EAD)",
              border: "none", color: "#fff", fontSize: 14, fontWeight: 700,
              cursor: "pointer", boxShadow: "0 4px 20px rgba(140,94,255,0.4)"
            }}>
              View My Profile →
            </button>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 999,
          background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20
        }}>
          <div style={{
            width: "100%", maxWidth: 480,
            background: "rgba(25,28,47,0.95)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 24, padding: "28px 32px",
            boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
            boxSizing: "border-box"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: "#fff", margin: 0 }}>Secure Checkout</h3>
              <button onClick={() => setShowCheckout(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>

            {/* Selected Plan Info */}
            <div style={{
              padding: "14px 18px", borderRadius: 12,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: 20
            }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Plan Selected</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{activePlan.name} Subscription</div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#8C5EFF" }}>{activePlan.price}</div>
            </div>

            {/* Card Inputs */}
            <form onSubmit={handlePurchase} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Cardholder Name</label>
                <input
                  type="text"
                  required
                  placeholder="John Doe"
                  value={cardName}
                  onChange={e => setCardName(e.target.value)}
                  style={{
                    width: "100%", padding: "10px 12px",
                    background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 9, color: "#fff", fontSize: 14,
                    outline: "none", boxSizing: "border-box"
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Card Number</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    required
                    placeholder="4000 1234 5678 9010"
                    value={cardNumber}
                    onChange={e => handleCardNumberChange(e.target.value)}
                    style={{
                      width: "100%", padding: "10px 12px 10px 42px",
                      background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 9, color: "#fff", fontSize: 14,
                      outline: "none", boxSizing: "border-box", letterSpacing: "0.05em"
                    }}
                  />
                  <span style={{ position: "absolute", left: 14, top: 11, fontSize: 16 }}>💳</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Expiry Date</label>
                  <input
                    type="text"
                    required
                    placeholder="MM/YY"
                    value={cardExpiry}
                    onChange={e => handleExpiryChange(e.target.value)}
                    style={{
                      width: "100%", padding: "10px 12px",
                      background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 9, color: "#fff", fontSize: 14,
                      outline: "none", boxSizing: "border-box", textAlign: "center"
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>CVC</label>
                  <input
                    type="password"
                    required
                    placeholder="•••"
                    maxLength={4}
                    value={cardCvc}
                    onChange={e => setCardCvc(e.target.value.replace(/\D/g, ""))}
                    style={{
                      width: "100%", padding: "10px 12px",
                      background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 9, color: "#fff", fontSize: 14,
                      outline: "none", boxSizing: "border-box", textAlign: "center"
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Billing Zip / Postal Code</label>
                <input
                  type="text"
                  required
                  placeholder="90210"
                  value={cardZip}
                  onChange={e => setCardZip(e.target.value)}
                  style={{
                    width: "100%", padding: "10px 12px",
                    background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 9, color: "#fff", fontSize: 14,
                    outline: "none", boxSizing: "border-box"
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <button type="button" onClick={() => setShowCheckout(false)} style={{
                  flex: 1, padding: "12px", borderRadius: 10,
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                  color: "var(--text-muted)", fontSize: 13, fontWeight: 700, cursor: "pointer"
                }}>Cancel</button>
                <button type="submit" disabled={processing || !isFormValid} style={{
                  flex: 2, padding: "12px", borderRadius: 10,
                  background: processing ? "rgba(140,94,255,0.3)" : isFormValid ? "linear-gradient(135deg, #8C5EFF, #FF5EAD)" : "rgba(255,255,255,0.08)",
                  border: "none", color: isFormValid ? "#fff" : "var(--text-dim)", fontSize: 13, fontWeight: 700,
                  cursor: processing || !isFormValid ? "default" : "pointer",
                  boxShadow: processing || !isFormValid ? "none" : "0 4px 16px rgba(140,94,255,0.3)"
                }}>
                  {processing ? "Processing..." : `Pay ${activePlan.price}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={{ position: "relative", zIndex: 1, maxWidth: 960, margin: "0 auto", padding: "50px 24px 60px" }}>

        {/* Back */}
        <Link to="/app" style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          color: "var(--text-muted)", fontSize: 13, fontWeight: 600,
          textDecoration: "none", marginBottom: 32, transition: "color 0.15s"
        }}
          onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
          Back to Chat
        </Link>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 50 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 16px", borderRadius: 999,
            background: "rgba(140,94,255,0.15)", border: "1px solid rgba(140,94,255,0.3)",
            fontSize: 12, fontWeight: 800, color: "#A78BFA",
            textTransform: "uppercase", letterSpacing: "0.1em",
            marginBottom: 20
          }}>
            💎 Premium
          </div>
          <h1 style={{
            fontSize: 42, fontWeight: 900, letterSpacing: "-0.03em",
            background: "linear-gradient(135deg, #8C5EFF 0%, #FF5EAD 50%, #FBBF24 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            marginBottom: 14, lineHeight: 1.1
          }}>
            Upgrade Your Experience
          </h1>
          <p style={{ fontSize: 16, color: "var(--text-muted)", maxWidth: 480, margin: "0 auto", lineHeight: 1.7 }}>
            Unlock animated avatars, custom banners, priority support, and exclusive features. Stand out from the crowd.
          </p>
        </div>

        {/* Already Premium Card */}
        {alreadyPremium && (
          <div style={{
            textAlign: "center", marginBottom: 40,
            padding: "28px 32px", borderRadius: 20,
            background: "linear-gradient(135deg, rgba(140,94,255,0.12), rgba(255,94,173,0.08))",
            border: "1px solid rgba(140,94,255,0.3)",
            boxShadow: "0 10px 30px rgba(140,94,255,0.1)"
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✨</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#A78BFA", marginBottom: 4 }}>You're a Premium Member!</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
              Thank you for supporting Lensly. You already have access to all premium features.
            </div>
            <button
              onClick={handleDowngrade}
              disabled={cancelling}
              style={{
                padding: "10px 24px", borderRadius: 10,
                background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#EF4444", fontSize: 13, fontWeight: 700, cursor: "pointer",
                transition: "all 0.15s"
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.25)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)"; }}
            >
              {cancelling ? "Downgrading..." : "Cancel Subscription (Downgrade)"}
            </button>
          </div>
        )}

        {/* Pricing Cards */}
        {!alreadyPremium && (
          <>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 16,
              marginBottom: 36,
            }}>
              {PLANS.map(plan => {
                const isSelected = selectedPlan === plan.id;
                return (
                  <div key={plan.id} onClick={() => setSelectedPlan(plan.id)} style={{
                    padding: "24px 22px",
                    borderRadius: 18,
                    background: isSelected ? "rgba(140,94,255,0.1)" : "rgba(255,255,255,0.03)",
                    border: `2px solid ${isSelected ? "#8C5EFF" : "rgba(255,255,255,0.07)"}`,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    position: "relative",
                    overflow: "hidden",
                  }}>
                    {/* Badge */}
                    {plan.badge && (
                      <div style={{
                        position: "absolute", top: 12, right: 12,
                        padding: "3px 8px", borderRadius: 6,
                        background: plan.id === "yearly" ? "linear-gradient(135deg, #8C5EFF, #FF5EAD)" : "linear-gradient(135deg, #FBBF24, #F97316)",
                        fontSize: 9, fontWeight: 900, color: "#fff",
                        letterSpacing: "0.08em", textTransform: "uppercase"
                      }}>{plan.badge}</div>
                    )}

                    {/* Radio indicator */}
                    <div style={{
                      width: 20, height: 20, borderRadius: "50%",
                      border: `2px solid ${isSelected ? "#8C5EFF" : "rgba(255,255,255,0.2)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      marginBottom: 14
                    }}>
                      {isSelected && <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#8C5EFF" }} />}
                    </div>

                    <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 4 }}>{plan.name}</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 8 }}>
                      <span style={{ fontSize: 30, fontWeight: 900, color: "#fff" }}>{plan.price}</span>
                      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{plan.period}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.5 }}>{plan.desc}</div>

                    {/* Features */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {plan.features.map((f, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)" }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8C5EFF" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                          {f}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Purchase Button */}
            <div style={{ textAlign: "center" }}>
              <button onClick={() => setShowCheckout(true)} style={{
                padding: "14px 48px",
                borderRadius: 14,
                background: "linear-gradient(135deg, #8C5EFF, #FF5EAD)",
                border: "none",
                color: "#fff",
                fontSize: 16, fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 6px 30px rgba(140,94,255,0.4)",
                transition: "all 0.2s",
                minWidth: 260,
              }}>
                Buy Premium — {PLANS.find(p => p.id === selectedPlan)?.price}
              </button>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 12 }}>
                🔒 Secured by Lensly. Cancel anytime from Settings.
              </div>
            </div>
          </>
        )}

        {/* Feature showcase */}
        <div style={{ marginTop: 56 }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 6 }}>Everything You Get</h2>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Premium features that make you stand out</p>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 14,
          }}>
            {[
              { icon: "🎨", title: "Animated Avatars", desc: "Use GIF avatars to express your personality", color: "#8C5EFF" },
              { icon: "🖼️", title: "Custom Banners", desc: "Set a unique profile banner image", color: "#4F7CFF" },
              { icon: "💎", title: "Premium Badge", desc: "Exclusive badge on your profile", color: "#FF5EAD" },
              { icon: "⚡", title: "Priority Support", desc: "Get faster responses from our team", color: "#FBBF24" },
              { icon: "📁", title: "Extended Uploads", desc: "Upload files up to 25–50 MB", color: "#34D399" },
              { icon: "🌟", title: "Early Access", desc: "Try new features before anyone else", color: "#06B6D4" },
            ].map((f, i) => (
              <div key={i} style={{
                padding: "18px 16px",
                borderRadius: 14,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                transition: "all 0.18s",
              }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = `${f.color}40`; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
              >
                <div style={{ fontSize: 24, marginBottom: 10 }}>{f.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{f.title}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div style={{ marginTop: 50 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#fff", textAlign: "center", marginBottom: 20 }}>Frequently Asked Questions</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 600, margin: "0 auto" }}>
            {[
              { q: "Can I cancel anytime?", a: "Yes, you can cancel your subscription at any time from your Settings page or directly on this page. You'll lose access to Premium-exclusive features." },
              { q: "What payment methods are accepted?", a: "We accept all major credit/debit cards through our secure checkout form." },
              { q: "Is Lifetime really forever?", a: "Yes! The Lifetime plan is a one-time payment. You'll keep Premium features for as long as Lensly exists." },
              { q: "What happens to my data if I cancel?", a: "All your data is preserved. You just lose access to Premium-exclusive features like animated avatars." },
            ].map((faq, i) => (
              <div key={i} style={{
                padding: "14px 18px", borderRadius: 12,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)"
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 5 }}>{faq.q}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>{faq.a}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
