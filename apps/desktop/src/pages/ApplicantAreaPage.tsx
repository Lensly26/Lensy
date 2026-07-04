import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../lib/auth-store.js";
import { detectAI } from "../lib/openaiDetect"; // AI detection via OpenAI
import { collection, query, where, getDocs, setDoc, doc, updateDoc, addDoc, onSnapshot, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase.js";
export function ApplicantAreaPage() {
  const me = useAuthStore((s) => s.me);
  const isGlobalStaff = me?.role && ["TRIAL_MODERATOR", "MODERATOR", "MODERATOR_PLUS", "ADMIN", "MANAGER", "DEVELOPER", "CO_OWNER", "OWNER"].includes(me.role.toUpperCase());
  const [myApp, setMyApp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ 
    age: "", experience: "", why: "", activeTime: "", abusingPowers: "",
    prevExperience: "", skills: "", communities: "", ruleBreaking: "",
    argument: "", harassment: "", respect: "", calm: "", feedback: "",
    professionalism: "", chooseYou: "", anythingElse: ""
  });
  const [cooldownTime, setCooldownTime] = useState<string | null>(null);
  const [appCount, setAppCount] = useState<number>(0);
  const [altBypassAttempts, setAltBypassAttempts] = useState<number>(0);
  const [blacklisted, setBlacklisted] = useState<boolean>(false);
  const [showDetails, setShowDetails] = useState(false);

  const questionConfigs = [
    { key: "age", label: "1. How old are you?", type: "input", required: true },
    { key: "experience", label: "2. Prior Moderation Experience", type: "textarea", required: true },
    { key: "why", label: "3. Why do you want to join Lensly Staff?", type: "textarea", required: true },
    { key: "activeTime", label: "4. When are you typically active on the server?", type: "input", required: true },
    { key: "abusingPowers", label: "5. How would you respond to a staff member abusing their powers?", type: "textarea", required: true },
    { key: "prevExperience", label: "6. Do you have previous staff experience? If yes, explain:", type: "textarea", required: true },
    { key: "skills", label: "7. What skills make you a good staff member?", type: "textarea", required: true },
    { key: "communities", label: "8. What communities or others apps have you staffed before?", type: "textarea", required: true },
    { key: "ruleBreaking", label: "9. How would you deal with someone breaking the rules repeatedly?", type: "textarea", required: true },
    { key: "argument", label: "10. How would you handle an argument between members?", type: "textarea", required: true },
    { key: "harassment", label: "11. Someone reports harassment in DMs. What steps would you take?", type: "textarea", required: true },
    { key: "respect", label: "12. Are you able to work respectfully with other staff members?", type: "input", required: true },
    { key: "calm", label: "13. Can you remain calm during stressful situations?", type: "input", required: true },
    { key: "feedback", label: "14. Are you comfortable taking feedback from higher staff?", type: "input", required: true },
    { key: "professionalism", label: "15. What does professionalism mean to you?", type: "textarea", required: true },
    { key: "chooseYou", label: "16. Why should we choose you over other applicants?", type: "textarea", required: true },
    { key: "anythingElse", label: "17. Anything else you'd like us to know?", type: "textarea", required: false }
  ];

  const answeredCount = questionConfigs.reduce((count, q) => {
    const value = (formData as any)[q.key];
    return count + (value && value.toString().trim() ? 1 : 0);
  }, 0);
  const requiredCount = questionConfigs.filter(q => q.required).length;
  const answeredRequiredCount = questionConfigs.reduce((count, q) => {
    if (!q.required) return count;
    const value = (formData as any)[q.key];
    return count + (value && value.toString().trim() ? 1 : 0);
  }, 0);
  const progressPercent = Math.round((answeredCount / questionConfigs.length) * 100);

  useEffect(() => {
    if (!me) return;

    // Fetch my application
    const q = query(collection(db, "staffApplications"), where("userId", "==", me.id));
    const unsubMyApp = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        // Find the most recent or pending one if multiple
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        const pending = docs.find(d => d.status === "PENDING");
        if (pending) {
          setMyApp(pending);
        } else {
          // just show the latest one
          docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setMyApp(docs[0]);
        }
      } else {
        setMyApp(null);
      }
      setLoading(false);
    }, (err) => {
      console.error("Error loading application:", err);
      setLoading(false);
    });

    // Check cooldown, app count, and blacklist status
    const getCooldown = async () => {
      const userDoc = await getDoc(doc(db, "users", me.id));
      const data = userDoc.data();
      if (data) {
        const cd = data.applicationCooldown;
        let currentCount = data.applicationCount || 0;
        if (cd && new Date(cd) > new Date()) {
          setCooldownTime(cd);
        } else {
          setCooldownTime(null);
          if (currentCount >= 2) {
            currentCount = 0; // Reset attempts after the 1-month cooldown expires
          }
        }
        setAppCount(currentCount);
        setAltBypassAttempts(data.altBypassAttempts || 0);
        setBlacklisted(data.blacklistedFromApplying || false);
      }
    };
    getCooldown();

    return () => unsubMyApp();
  }, [me]);


  const submitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!me) return;
    if (blacklisted) return alert("You are blacklisted from applying.");
    if (appCount >= 2) return alert("You must wait until your cooldown expires.");
    if (cooldownTime) return alert("You are on an application cooldown.");
    if (myApp && myApp.status === "PENDING") return alert("You already have a pending application.");

    // Alt Account Detection via LocalStorage
    const appliedAccounts = JSON.parse(localStorage.getItem('Lensly_applied_accounts') || '[]');
    const isAlt = appliedAccounts.length > 0 && !appliedAccounts.includes(me.id);

    if (isAlt) {
      const newAttempts = altBypassAttempts + 1;
      if (newAttempts === 1) {
        // 1st offense: 2 weeks (14 days)
        const cd = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
        await updateDoc(doc(db, "users", me.id), { altBypassAttempts: newAttempts, applicationCooldown: cd });
        setAltBypassAttempts(newAttempts);
        setCooldownTime(cd);
        return alert("Alt account detected. You have been placed on a 2-week application cooldown.");
      } else if (newAttempts === 2) {
        // 2nd offense: 1 month (30 days)
        const cd = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
        await updateDoc(doc(db, "users", me.id), { altBypassAttempts: newAttempts, applicationCooldown: cd });
        setAltBypassAttempts(newAttempts);
        setCooldownTime(cd);
        return alert("Alt account detected again. You have been placed on a 1-month application cooldown.");
      } else {
        // 3rd offense: Perm blacklist
        await updateDoc(doc(db, "users", me.id), { altBypassAttempts: newAttempts, blacklistedFromApplying: true });
        setBlacklisted(true);
        return alert("You have been permanently blacklisted from applying for repeated alt account abuse.");
      }
    }

    // Register this account as having applied in local storage
    if (!appliedAccounts.includes(me.id)) {
      appliedAccounts.push(me.id);
      localStorage.setItem('Lensly_applied_accounts', JSON.stringify(appliedAccounts));
    }

    const combinedText = Object.values(formData).join(" ");
    let isAI = false;
    try {
      // Call OpenAI detection; falls back to false on error
      isAI = await detectAI(combinedText);
    } catch (e) {
      console.error("AI detection error:", e);
      isAI = false;
    }

    const status = isAI ? "DENIED" : "PENDING";
    const statusReason = isAI ? "Automated AI Detection: Use of AI tools is not allowed." : null;

    try {
      await addDoc(collection(db, "staffApplications"), {
        userId: me.id,
        username: me.username,
        answers: formData,
        status: status,
        statusReason: statusReason,
        createdAt: new Date().toISOString()
      });

        // Update user document with new count; only set cooldown for AI detection
        const newCount = appCount + 1;
        const updates: any = { applicationCount: newCount };
        // If AI detected, impose a 60-day (2 month) cooldown
        if (isAI) {
          updates.applicationCooldown = new Date(Date.now() + 1000 * 60 * 60 * 24 * 60).toISOString();
        }
        await updateDoc(doc(db, "users", me.id), updates);
        setAppCount(newCount);
        // Update local cooldown state if set
        if (updates.applicationCooldown) {
          setCooldownTime(updates.applicationCooldown);
        }
        if (isAI) {
          alert("Application denied automatically by AI detection.");
        } else {
          alert("Application submitted successfully! Please wait for staff to review.");
        }

    } catch (err) {
      alert("Failed to submit: " + String(err));
    }
  };

  if (loading) return <div style={{ padding: 40, color: "#fff" }}>Loading...</div>;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-deep)", color: "var(--text)", padding: "40px 20px" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 34, fontWeight: 900, margin: 0 }}>📋 Staff Applicant Area</h1>
            <p style={{ margin: "10px 0 0", color: "var(--text-muted)", maxWidth: 560, lineHeight: 1.6 }}>
              Complete the Lensly staff application below. Answer clearly and honestly so our review team can assess your fit for the role.
            </p>
          </div>
          <Link to="/app" className="btn btn-primary" style={{ textDecoration: "none", whiteSpace: "nowrap" }}>Back to App</Link>
        </div>

        <div style={{ background: "rgba(10,12,20,0.96)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 34, boxShadow: "0 30px 100px rgba(0,0,0,0.3)" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Apply for Lensly Staff</h2>
          <div style={{ display: "grid", gap: 10, marginBottom: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>{answeredCount}/{questionConfigs.length} questions complete</span>
              <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>{answeredRequiredCount}/{requiredCount} required answered</span>
            </div>
            <div style={{ width: "100%", height: 10, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
              <div style={{ width: `${progressPercent}%`, height: "100%", borderRadius: 999, background: "linear-gradient(135deg, #4F46E5, #22C55E)", transition: "width 0.2s ease" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)" }}>
              <span>Progress</span>
              <span>{progressPercent}%</span>
            </div>
          </div>

          {blacklisted ? (
            <div style={{ background: "rgba(239,68,68,0.1)", padding: 20, borderRadius: 12, border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444", textAlign: "center" }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Access Denied</h3>
              <p>you have been blacklisted for repeted alt account deteted</p>
            </div>
          ) : cooldownTime ? (
            <div style={{ background: "rgba(239,68,68,0.1)", padding: 20, borderRadius: 12, border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444" }}>
              You are currently on an application cooldown until {new Date(cooldownTime).toLocaleString()}.
            </div>
          ) : myApp && myApp.status === "PENDING" ? (
            <div style={{ background: "rgba(79,124,255,0.1)", padding: 20, borderRadius: 12, border: "1px solid rgba(79,124,255,0.3)" }}>
              <h3 style={{ fontSize: 16, color: "var(--accent)", marginBottom: 8 }}>Status: {myApp.status}</h3>
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Submitted on {new Date(myApp.createdAt).toLocaleDateString()}</p>
            </div>
          ) : myApp && myApp.status === "ACCEPTED" ? (
            <div style={{ background: "rgba(16,185,129,0.1)", padding: 20, borderRadius: 12, border: "1px solid rgba(16,185,129,0.3)" }}>
              <h3 style={{ fontSize: 16, color: "#10B981", marginBottom: 8 }}>Status: ACCEPTED</h3>
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Congratulations! You are now a Trial Moderator.</p>
            </div>
          ) : (
            <form onSubmit={submitApplication} style={{ display: "grid", gap: 24 }}>
              {myApp && myApp.status === "DENIED" && (
                <div style={{ background: "rgba(239,68,68,0.12)", padding: 18, borderRadius: 16, border: "1px solid rgba(239,68,68,0.25)", color: "#FECACA", marginBottom: 4 }}>
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>Previous application denied.</div>
                  <div style={{ fontSize: 14, lineHeight: 1.6 }}>You have {2 - appCount} attempt(s) remaining. Please revise your answers and avoid AI-generated responses.</div>
                  {myApp.statusReason && <p style={{ marginTop: 10, fontSize: 14, fontWeight: 600 }}>Reason: {myApp.statusReason}</p>}
                </div>
              )}

              <div style={{ display: "grid", gap: 18 }}>
                {questionConfigs.map((q) => (
                  <div key={q.key} style={{ display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                      <label style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: 0 }}>{q.label}</label>
                      {q.required && <span style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Required</span>}
                    </div>
                    {q.type === "input" ? (
                      <input
                        type="text"
                        value={(formData as any)[q.key]}
                        onChange={e => setFormData({ ...formData, [q.key]: e.target.value })}
                        required={q.required}
                        style={{ width: "100%", padding: "16px 18px", borderRadius: 18, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontSize: 14, outline: "none" }}
                      />
                    ) : (
                      <textarea
                        value={(formData as any)[q.key]}
                        onChange={e => setFormData({ ...formData, [q.key]: e.target.value })}
                        required={q.required}
                        style={{ width: "100%", minHeight: 120, padding: "16px 18px", borderRadius: 18, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontSize: 14, resize: "vertical", lineHeight: 1.7, outline: "none" }}
                      />
                    )}
                  </div>
                ))}
              </div>

              <button type="submit" className="btn btn-primary" style={{ padding: "14px 26px", fontSize: 16, alignSelf: "flex-start", minWidth: 220 }}>Submit Application</button>
            </form>
          )}
        </div>



      </div>
    </div>
  );
}
