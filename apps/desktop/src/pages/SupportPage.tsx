import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { collection, addDoc, query, where, onSnapshot, orderBy, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase.js";
import { useAuthStore } from "../lib/auth-store.js";

interface Ticket {
  id: string;
  authorId: string;
  authorUsername?: string;
  subject: string;
  description: string;
  status: "OPEN" | "IN_PROGRESS" | "CLOSED";
  createdAt: string;
  category?: string;
  assignedTo?: string;
  staffNotes?: string;
}

interface TicketMessage {
  id: string;
  ticketId: string;
  authorId: string;
  authorName?: string;
  content: string;
  isStaff: boolean;
  createdAt: string;
}

export function SupportPage() {
  const me = useAuthStore((s) => s.me);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"new" | "mytickets">("new");

  // My tickets state
  const [myTickets, setMyTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [reply, setReply] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const faqs = [
    {
      q: "How do I report a user or message?",
      a: "You can easily report any message by right-clicking it in chat and selecting 'Report to Staff'. Our moderation team reviews all reports, and you will receive an official confirmation in your Direct Messages from the 'Lensly' system account once handled."
    },
    {
      q: "Where can I download the Lensly Desktop App?",
      a: "You can download the official Lensly Desktop App for Windows, macOS, and Linux directly from our support page or update banner. Click the download button below to get the latest v2.9.2 installer!"
    },
    {
      q: "How do I create or join a server?",
      a: "In the main app, click the '+' icon in the server rail on the left to create a new server. To join a server, click 'Join Server' and enter the invite code or Server ID."
    },
    {
      q: "What should I do if my account or server is suspended?",
      a: "If your account or server receives a disciplinary suspension, you can submit an official appeal through this Support Center by creating a support ticket below. Be sure to include your username and the reason for appeal."
    }
  ];

  const filteredFaqs = faqs.filter(f => f.q.toLowerCase().includes(searchQuery.toLowerCase()) || f.a.toLowerCase().includes(searchQuery.toLowerCase()));

  // Load the user's tickets in real-time
  useEffect(() => {
    if (!me) return;
    const identifier = me.username || me.id;
    const q = query(
      collection(db, "tickets"),
      where("authorId", "in", [identifier, me.id, me.username].filter(Boolean))
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Ticket));
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setMyTickets(data);
    });
    return () => unsub();
  }, [me]);

  // Load messages for selected ticket
  useEffect(() => {
    if (!selectedTicket) { setMessages([]); return; }
    const q = query(
      collection(db, "ticketMessages"),
      where("ticketId", "==", selectedTicket.id),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as TicketMessage)));
    });
    return () => unsub();
  }, [selectedTicket]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmitTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      alert("Please enter both a subject and description for your ticket.");
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, "tickets"), {
        authorId: me?.username || me?.id || "Anonymous User",
        authorUsername: me?.username || me?.displayName || "Anonymous User",
        subject: subject.trim(),
        description: description.trim(),
        status: "OPEN",
        createdAt: new Date().toISOString()
      });
      setSubmitted(true);
      setSubject("");
      setDescription("");
    } catch (err) {
      console.error(err);
      alert("Failed to submit support ticket. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendReply() {
    if (!reply.trim() || !selectedTicket || !me || sendingReply) return;
    setSendingReply(true);
    try {
      await addDoc(collection(db, "ticketMessages"), {
        ticketId: selectedTicket.id,
        authorId: me.id || me.username,
        authorName: me.displayName || me.username,
        content: reply.trim(),
        isStaff: false,
        createdAt: serverTimestamp(),
      });
      setReply("");
    } catch (err) {
      console.error(err);
      alert("Failed to send reply. Please try again.");
    } finally {
      setSendingReply(false);
    }
  }

  const statusColor = (s: string) =>
    s === "CLOSED" ? { bg: "rgba(255,255,255,0.08)", text: "var(--text-muted)" }
    : s === "IN_PROGRESS" ? { bg: "rgba(245,158,11,0.15)", text: "#F59E0B" }
    : { bg: "rgba(52,211,153,0.15)", text: "#34D399" };

  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg-deep)", color: "var(--text)",
      fontFamily: "var(--font-sans)", display: "flex", flexDirection: "column"
    }}>
      {/* Top Navbar */}
      <header style={{
        background: "rgba(10,10,14,0.8)", backdropFilter: "blur(20px)", borderBottom: "1px solid var(--border)",
        padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 24 }}>💬</span>
          <span style={{ fontSize: 20, fontWeight: 800, background: "linear-gradient(90deg,#fff,#aaa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Lensly Support Center
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link to="/download" className="btn btn-ghost" style={{ fontSize: 14, fontWeight: 700, color: "#34D399", border: "1px solid rgba(52,211,153,0.3)", borderRadius: 8, padding: "8px 16px" }}>
            📥 Download App (v2.9.2)
          </Link>
          <Link to="/app" className="btn btn-primary" style={{ fontSize: 14, fontWeight: 700, borderRadius: 8, padding: "8px 16px" }}>
            Open Lensly
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 1100, width: "100%", margin: "0 auto", padding: "48px 24px", flex: 1, display: "flex", flexDirection: "column", gap: 48 }}>
        {/* Hero Section */}
        <section style={{ textAlign: "center", position: "relative", padding: "40px 0" }}>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 300, height: 300, background: "var(--accent)", filter: "blur(150px)", opacity: 0.15, pointerEvents: "none" }} />
          <h1 style={{ fontSize: 44, fontWeight: 900, marginBottom: 16, letterSpacing: "-0.03em" }}>
            How can we help you today?
          </h1>
          <p style={{ fontSize: 18, color: "var(--text-muted)", maxWidth: 600, margin: "0 auto 32px" }}>
            Search our knowledge base, download the latest desktop client, or submit an official ticket to our 24/7 moderation & support staff.
          </p>
          <div style={{ maxWidth: 540, margin: "0 auto", position: "relative" }}>
            <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", fontSize: 18, color: "var(--text-muted)" }}>🔍</span>
            <input
              type="text"
              placeholder="Search guides, FAQs, or keywords..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: "100%", padding: "16px 20px 16px 48px", borderRadius: 16, background: "var(--bg-panel)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 16, boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}
            />
          </div>
        </section>

        {/* Download App Banner */}
        <section style={{ background: "linear-gradient(135deg, rgba(52,211,153,0.15), rgba(16,185,129,0.05))", border: "1px solid rgba(52,211,153,0.3)", borderRadius: 24, padding: "36px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 24, boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 24 }}>🚀</span>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: "#34D399" }}>Experience Lensly Desktop</h2>
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: 15, maxWidth: 500, lineHeight: 1.5 }}>
              Get the ultimate desktop experience with built-in rich presence, global hotkeys, right-click context menus, and hardware-accelerated voice calls.
            </p>
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <a href="/Lensly-Setup-2.9.2.exe" download="Lensly-Setup-2.9.2.exe" className="btn btn-primary" style={{ background: "#34D399", color: "#111", border: "none", padding: "14px 28px", fontSize: 16, fontWeight: 800, borderRadius: 12, boxShadow: "0 8px 20px rgba(52,211,153,0.3)" }}>
              📥 Download for Windows (.exe)
            </a>
            <a href="/Lensly-2.9.2.dmg" download="Lensly-2.9.2.dmg" className="btn btn-ghost" style={{ border: "1px solid var(--border)", padding: "14px 28px", fontSize: 16, fontWeight: 700, borderRadius: 12 }}>
              🍏 macOS (.dmg)
            </a>
          </div>
        </section>

        {/* FAQs */}
        <section style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 24, padding: 32 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 24, display: "flex", alignItems: "center", gap: 8 }}>
            <span>📚</span> Frequently Asked Questions
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {filteredFaqs.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: 14, padding: "20px 0", textAlign: "center" }}>No matching FAQs found.</div>
            ) : (
              filteredFaqs.map((faq, idx) => {
                const isOpen = activeFaq === idx;
                return (
                  <div key={idx} style={{ border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden", background: "var(--bg-elevated)" }}>
                    <button
                      onClick={() => setActiveFaq(isOpen ? null : idx)}
                      style={{ width: "100%", padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", color: "var(--text)", fontSize: 15, fontWeight: 700, textAlign: "left", cursor: "pointer" }}
                    >
                      <span>{faq.q}</span>
                      <span style={{ fontSize: 12, color: "var(--accent)" }}>{isOpen ? "▲" : "▼"}</span>
                    </button>
                    {isOpen && (
                      <div style={{ padding: "0 20px 20px", color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Tickets Section */}
        <section style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 24, overflow: "hidden" }}>
          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
            <button
              onClick={() => setActiveTab("new")}
              style={{ flex: 1, padding: "20px 24px", background: "none", border: "none", color: activeTab === "new" ? "var(--text)" : "var(--text-muted)", fontSize: 15, fontWeight: 800, cursor: "pointer", borderBottom: activeTab === "new" ? "2px solid var(--accent)" : "2px solid transparent", transition: "all 0.2s" }}
            >
              ✉️ Submit a Ticket
            </button>
            <button
              onClick={() => setActiveTab("mytickets")}
              style={{ flex: 1, padding: "20px 24px", background: "none", border: "none", color: activeTab === "mytickets" ? "var(--text)" : "var(--text-muted)", fontSize: 15, fontWeight: 800, cursor: "pointer", borderBottom: activeTab === "mytickets" ? "2px solid var(--accent)" : "2px solid transparent", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              📂 My Tickets
              {myTickets.filter(t => t.status !== "CLOSED").length > 0 && (
                <span style={{ fontSize: 11, background: "var(--accent)", color: "#fff", padding: "2px 8px", borderRadius: 999, fontWeight: 900 }}>
                  {myTickets.filter(t => t.status !== "CLOSED").length}
                </span>
              )}
            </button>
          </div>

          {/* Submit a Ticket */}
          {activeTab === "new" && (
            <div style={{ padding: 32 }}>
              <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
                Need direct staff assistance? Submit a ticket below and our moderation & support team will respond within 24 hours.
              </p>
              {submitted ? (
                <div style={{ background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: 16, padding: 24, textAlign: "center" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: "#34D399", marginBottom: 8 }}>Ticket Submitted Successfully!</h3>
                  <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 20 }}>
                    We have received your request. You can track your open tickets and reply to staff in the <strong style={{ color: "var(--text)" }}>My Tickets</strong> tab.
                  </p>
                  <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                    <button onClick={() => setSubmitted(false)} className="btn btn-ghost" style={{ fontSize: 14, fontWeight: 700 }}>
                      Submit Another Ticket
                    </button>
                    <button onClick={() => { setSubmitted(false); setActiveTab("mytickets"); }} className="btn btn-primary" style={{ fontSize: 14, fontWeight: 700 }}>
                      View My Tickets →
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmitTicket} style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 600 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8 }}>
                      Your Username / ID {me ? `(Logged in as ${me.username})` : "(Optional)"}
                    </label>
                    <input
                      type="text"
                      disabled={!!me}
                      value={me ? me.username : ""}
                      placeholder="Anonymous User"
                      style={{ width: "100%", padding: "12px 16px", borderRadius: 12, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 14 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8 }}>
                      Subject / Topic *
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      placeholder="e.g., Account Suspension Appeal / Bug Report"
                      required
                      style={{ width: "100%", padding: "12px 16px", borderRadius: 12, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 14 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8 }}>
                      Detailed Description *
                    </label>
                    <textarea
                      rows={5}
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Please provide as much detail as possible regarding your issue..."
                      required
                      style={{ width: "100%", padding: "12px 16px", borderRadius: 12, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 14 }}
                    />
                  </div>
                  <button type="submit" disabled={submitting} className="btn btn-primary" style={{ padding: "14px", fontSize: 16, fontWeight: 800, borderRadius: 12, background: "var(--accent)", color: "#fff", border: "none", cursor: submitting ? "not-allowed" : "pointer" }}>
                    {submitting ? "Submitting Ticket..." : "🚀 Submit Support Ticket"}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* My Tickets */}
          {activeTab === "mytickets" && (
            <div style={{ display: "flex", minHeight: 500 }}>
              {/* Ticket list */}
              <div style={{ width: 300, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", background: "rgba(0,0,0,0.2)" }}>
                <div style={{ padding: "20px 16px", borderBottom: "1px solid var(--border)", fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Your Tickets
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
                  {!me ? (
                    <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 14, padding: "32px 16px" }}>
                      <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
                      Please log in to view your tickets.
                    </div>
                  ) : myTickets.length === 0 ? (
                    <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 14, padding: "32px 16px" }}>
                      <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
                      No tickets yet. Submit one to get started!
                    </div>
                  ) : (
                    myTickets.map(t => {
                      const sc = statusColor(t.status);
                      const isSelected = selectedTicket?.id === t.id;
                      return (
                        <div
                          key={t.id}
                          onClick={() => setSelectedTicket(t)}
                          style={{ padding: "14px 12px", borderRadius: 12, marginBottom: 4, cursor: "pointer", background: isSelected ? "rgba(79,124,255,0.1)" : "transparent", border: isSelected ? "1px solid rgba(79,124,255,0.2)" : "1px solid transparent", transition: "all 0.15s" }}
                          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6, gap: 8 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.subject}</span>
                            <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: sc.bg, color: sc.text, whiteSpace: "nowrap", flexShrink: 0 }}>{t.status}</span>
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{new Date(t.createdAt).toLocaleDateString()}</div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Ticket chat view */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                {selectedTicket ? (
                  <>
                    {/* Header */}
                    <div style={{ padding: "20px 28px", borderBottom: "1px solid var(--border)", background: "rgba(0,0,0,0.15)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <h3 style={{ margin: "0 0 6px 0", fontSize: 18, fontWeight: 800 }}>{selectedTicket.subject}</h3>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          Opened {new Date(selectedTicket.createdAt).toLocaleString()}
                          {selectedTicket.assignedTo && <span style={{ color: "var(--accent)", fontWeight: 700 }}> · Assigned to @{selectedTicket.assignedTo}</span>}
                        </div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 800, padding: "5px 14px", borderRadius: 999, background: statusColor(selectedTicket.status).bg, color: statusColor(selectedTicket.status).text }}>
                        {selectedTicket.status}
                      </span>
                    </div>

                    {/* Messages */}
                    <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
                      {/* Show original ticket description as first message */}
                      <div style={{ display: "flex", gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                          {(me?.displayName || me?.username || "U")[0].toUpperCase()}
                        </div>
                        <div style={{ background: "rgba(255,255,255,0.03)", padding: "12px 16px", borderRadius: 16, borderTopLeftRadius: 4, maxWidth: "80%", border: "1px solid rgba(255,255,255,0.06)" }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 800 }}>{me?.displayName || me?.username || "You"}</span>
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(selectedTicket.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                          <div style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{selectedTicket.description}</div>
                        </div>
                      </div>

                      {/* Additional messages */}
                      {messages.map(m => (
                        <div key={m.id} style={{ display: "flex", gap: 12, flexDirection: m.isStaff ? "row-reverse" : "row" }}>
                          <div style={{ width: 36, height: 36, borderRadius: "50%", background: m.isStaff ? "linear-gradient(135deg, var(--accent), var(--accent-2, #8C5EFF))" : "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, flexShrink: 0, boxShadow: m.isStaff ? "0 4px 12px rgba(79,124,255,0.3)" : "none" }}>
                            {(m.authorName || "?")[0].toUpperCase()}
                          </div>
                          <div style={{ background: m.isStaff ? "rgba(79,124,255,0.1)" : "rgba(255,255,255,0.03)", padding: "12px 16px", borderRadius: 16, borderTopRightRadius: m.isStaff ? 4 : 16, borderTopLeftRadius: m.isStaff ? 16 : 4, maxWidth: "80%", border: m.isStaff ? "1px solid rgba(79,124,255,0.2)" : "1px solid rgba(255,255,255,0.06)" }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexDirection: m.isStaff ? "row-reverse" : "row" }}>
                              <span style={{ fontSize: 13, fontWeight: 800, color: m.isStaff ? "var(--accent)" : "#fff" }}>{m.authorName || m.authorId}</span>
                              {m.isStaff && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "var(--accent)", color: "#fff", fontWeight: 900 }}>STAFF</span>}
                              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                {m.createdAt ? new Date(m.createdAt as unknown as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                              </span>
                            </div>
                            <div style={{ fontSize: 14, color: "var(--text)", whiteSpace: "pre-wrap", textAlign: m.isStaff ? "right" : "left", lineHeight: 1.6 }}>{m.content}</div>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Reply box */}
                    <div style={{ padding: "16px 28px", borderTop: "1px solid var(--border)", background: "rgba(0,0,0,0.15)" }}>
                      {selectedTicket.status === "CLOSED" ? (
                        <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 14, padding: "12px 0", fontWeight: 600 }}>
                          🔒 This ticket is closed. Submit a new ticket if you need further assistance.
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 12 }}>
                          <textarea
                            value={reply}
                            onChange={e => setReply(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSendReply(); } }}
                            placeholder="Type your reply... (Enter to send, Shift+Enter for new line)"
                            rows={2}
                            style={{ flex: 1, padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 14, resize: "none", outline: "none", lineHeight: 1.5 }}
                          />
                          <button
                            disabled={sendingReply || !reply.trim()}
                            onClick={() => void handleSendReply()}
                            className="btn btn-primary"
                            style={{ padding: "0 28px", borderRadius: 12, fontSize: 15, fontWeight: 800, opacity: (!reply.trim() || sendingReply) ? 0.5 : 1, cursor: (!reply.trim() || sendingReply) ? "not-allowed" : "pointer" }}
                          >
                            {sendingReply ? "Sending..." : "Reply"}
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", gap: 12 }}>
                    <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>Select a ticket to view the conversation</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid var(--border)", padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
        <div style={{ marginBottom: 12, display: "flex", justifyContent: "center", gap: 24 }}>
          <Link to="/app" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 700 }}>Open App</Link>
          <Link to="/status" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 700 }}>System Status</Link>
          <Link to="/stats" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 700 }}>Platform Stats</Link>
          <Link to="/update" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 700 }}>Releases</Link>
        </div>
        <div>© 2026 Lensly Inc. All rights reserved. Official Lensly Support & Moderation Center.</div>
      </footer>
    </div>
  );
}
