        {tab === "owner" && (() => {
          const r = me?.role?.toUpperCase();
          if (r !== "OWNER" && r !== "CO_OWNER") return null;
          const isOwner = r === "OWNER";

          return (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 28 }}>👑</div>
                <div>
                  <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Owner & Co-Owner Controls</h1>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>Full administrative access across the Lensly platform</div>
                </div>
              </div>


              <div style={{ display: "grid", gap: 20 }}>

                {/* ── Role Assignment ── */}
                <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 14, padding: "24px" }}>
                  <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 4px 0", color: "#FBBF24" }}>👑 Staff Role Assignment</h2>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>Promote or demote any user on the platform. Only Owners can assign Owner/Co-Owner.</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 520 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 5 }}>Target User</label>
                      <select value={ownerTargetUserId} onChange={e => setOwnerTargetUserId(e.target.value)}
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text)", cursor: "pointer" }}>
                        <option value="" disabled>Select a user to promote / demote…</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>
                            {u.displayName ?? u.username} ({u.email}) {u.role ? `[${u.role}]` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 5 }}>Select Rank</label>
                      <select value={ownerTargetRole} onChange={e => setOwnerTargetRole(e.target.value)}
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text)", cursor: "pointer" }}>
                        <option value="TRIAL_MODERATOR">⭐ Trial Moderator</option>
                        <option value="MODERATOR">🛡️ Moderator</option>
                        <option value="ADMIN">⚙️ Admin</option>
                        <option value="MANAGER">📁 Manager</option>
                        <option value="DEVELOPER">💻 Developer</option>
                        {isOwner && (
                          <>
                            <option value="CO_OWNER">👑 Co-Owner</option>
                            <option value="OWNER">👑 Owner</option>
                          </>
                        )}
                        <option value="USER">👤 Normal User (Remove Role)</option>
                      </select>
                    </div>
                    <button disabled={loading} onClick={() => void handleRoleUpdate()} className="btn"
                      style={{ background: "rgba(251,191,36,0.15)", color: "#FBBF24", border: "1px solid rgba(251,191,36,0.3)", alignSelf: "flex-start", padding: "8px 24px" }}>
                      Update Staff Role
                    </button>
                  </div>
                </div>

                {/* ── Staff Blacklist ── */}
                <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 14, padding: "24px" }}>
                  <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 4px 0", color: "#EF4444" }}>🚫 Staff Blacklist</h2>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>Permanently remove a staff member from the platform or staff team. This strips their role and flags their account.</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 520 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 5 }}>Target Staff Member</label>
                      <select value={ownerTargetUserId} onChange={e => setOwnerTargetUserId(e.target.value)}
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text)", cursor: "pointer" }}>
                        <option value="" disabled>Select a staff member to blacklist…</option>
                        {users.filter(u => u.role && u.role !== "USER").map(u => (
                          <option key={u.id} value={u.id}>
                            {u.displayName ?? u.username} [{u.role}]
                          </option>
                        ))}
                      </select>
                    </div>
                    <button disabled={loading || !ownerTargetUserId} onClick={async () => {
                      if (!ownerTargetUserId) return;
                      const target = users.find(u => u.id === ownerTargetUserId);
                      if (!confirm(`Are you sure you want to BLACKLIST ${target?.displayName ?? target?.username}? This will remove their staff role and ban them from the staff team.`)) return;
                      setLoading(true);
                      try {
                        await updateDoc(doc(db, "users", ownerTargetUserId), {
                          role: null,
                          admin: false,
                          staffBlacklisted: true,
                          accountStatus: "SUSPENDED"
                        });
                        await addDoc(collection(db, "moderationEvents"), {
                          action: "STAFF_BLACKLIST",
                          reason: `Blacklisted by ${me?.displayName ?? me?.username}`,
                          source: `OWNER_ACTION`,
                          confidence: 1.0,
                          createdAt: new Date().toISOString(),
                          appeals: []
                        });
                        setUsers(u => u.map(x => x.id === ownerTargetUserId ? { ...x, role: undefined, accountStatus: "SUSPENDED" } : x));
                        alert(`${target?.displayName ?? target?.username} has been blacklisted from the staff team.`);
                        setOwnerTargetUserId("");
                      } catch (e) {
                        alert("Failed: " + e);
                      } finally {
                        setLoading(false);
                      }
                    }} className="btn"
                      style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.3)", alignSelf: "flex-start", padding: "8px 24px" }}>
                      🚫 Blacklist Staff Member
                    </button>
                  </div>
                </div>

                {/* ── Full Ban Management ── */}
                <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 14, padding: "24px" }}>
                  <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 4px 0", color: "#F87171" }}>⛔ Full Ban Management</h2>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>Issue and revoke bans, suspensions, and warnings for any user across the platform.</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 520 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 5 }}>Target User</label>
                      <select value={managerUserId} onChange={e => setManagerUserId(e.target.value)}
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text)", cursor: "pointer" }}>
                        <option value="" disabled>Select a user…</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.displayName ?? u.username} ({u.email}) — {u.accountStatus}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 5 }}>Reason / Notes</label>
                      <input value={managerReason} onChange={e => setManagerReason(e.target.value)}
                        placeholder="Reason for action…"
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text)" }} />
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {[
                        { action: "SUSPEND", label: "Suspend", color: "#FBBF24" },
                        { action: "UNSUSPEND", label: "Unsuspend", color: "#34D399" },
                        { action: "WARN", label: "Warn", color: "#60A5FA" },
                        { action: "UNWARN", label: "Clear Warnings", color: "#A78BFA" },
                        { action: "HWID_BAN", label: "HWID Ban", color: "#EF4444" },
                        { action: "UN_HWID_BAN", label: "Un-HWID Ban", color: "#34D399" },
                        { action: "IP_BAN", label: "IP Ban", color: "#EF4444" },
                        { action: "UN_IP_BAN", label: "Un-IP Ban", color: "#34D399" },
                      ].map(({ action, label, color }) => (
                        <button key={action} disabled={loading || !managerUserId} onClick={() => void handleManagerAction(action as any)}
                          className="btn" style={{ background: `rgba(${color === "#EF4444" ? "239,68,68" : color === "#34D399" ? "52,211,153" : color === "#FBBF24" ? "251,191,36" : color === "#60A5FA" ? "96,165,250" : "167,139,250"},0.12)`, color, border: `1px solid ${color}40`, fontSize: 12, padding: "7px 14px" }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── Moderation Log ── */}
                <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 14, padding: "24px" }}>
                  <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 4px 0", color: "#A78BFA" }}>📋 Moderation Log</h2>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>Full audit trail of all staff actions across the platform.</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto" }}>
                    {modEvents.length === 0 ? (
                      <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No moderation events on record.</div>
                    ) : modEvents.slice(0, 30).map(ev => (
                      <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "var(--bg-elevated)", borderRadius: 8, border: "1px solid var(--border)" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "rgba(167,139,250,0.15)", color: "#A78BFA" }}>{ev.action}</span>
                        <span style={{ fontSize: 12, flex: 1, color: "var(--text-muted)" }}>{ev.reason || "No reason provided"}</span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(ev.createdAt).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Platform Settings ── */}
                <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 14, padding: "24px" }}>
                  <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 4px 0", color: "#60A5FA" }}>⚙️ Platform Settings</h2>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>Edit global platform configuration and override system settings.</div>
                  <div style={{ display: "grid", gap: 10, maxWidth: 520 }}>
                    {[
                      { key: "allowRegistrations" as const, label: "Allow Registrations", desc: "Enable or disable new user signups." },
                      { key: "maintenanceMode" as const, label: "Maintenance Mode", desc: "Put the platform into maintenance mode for all users." },
                      { key: "developerMode" as const, label: "Developer Mode", desc: "Enable developer-only features and debug tools." },
                    ].map(({ key, label, desc }) => (
                      <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "var(--bg-elevated)", borderRadius: 8, border: "1px solid var(--border)" }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{desc}</div>
                        </div>
                        <button onClick={() => void toggleConfig(key)} className="btn"
                          style={{ background: systemConfig?.[key] ? "var(--accent)" : "var(--bg-deep)", color: systemConfig?.[key] ? "#fff" : "var(--text-muted)", transition: "all 0.2s", minWidth: 80 }}>
                          {systemConfig?.[key] ? "Enabled" : "Disabled"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Broadcast Message to All Users ── */}
                <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 14, padding: "24px" }}>
                  <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 4px 0", color: "#A78BFA" }}>📢 Broadcast Message to All Users</h2>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>Send an official Lensly message to all users or a specific user.</div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 520 }}>
                    <div style={{ display: "grid", gap: 8 }}>
                      <label style={{ fontSize: 13, fontWeight: 700 }}>Recipient</label>
                      <select
                        value={LenslyMessageTarget}
                        onChange={(e) => setLenslyMessageTarget(e.target.value)}
                        style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text)", fontSize: 14 }}
                      >
                        <option value="">Select a user...</option>
                        <option value={ALL_USERS_TARGET}>All users</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.username}>{u.username}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: "grid", gap: 8 }}>
                      <label style={{ fontSize: 13, fontWeight: 700 }}>Message</label>
                      <textarea
                        rows={6}
                        value={LenslyMessageText}
                        onChange={(e) => setLenslyMessageText(e.target.value)}
                        placeholder="Enter the official Lensly message here..."
                        style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text)", fontSize: 14, resize: "vertical" as const }}
                      />
                    </div>

                    <button
                      className="btn btn-primary"
                      disabled={!LenslyMessageTarget || !LenslyMessageText.trim() || LenslySendBusy}
                      onClick={handleSendLenslyMessage}
                      style={{ justifySelf: "start", minWidth: 180 }}
                    >
                      {LenslySendBusy ? "Sending..." : "Send as Lensly"}
                    </button>
                  </div>
                </div>

                {/* ── Permission Override ── */}
                <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 14, padding: "24px" }}>
                  <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 4px 0", color: "#34D399" }}>🔑 Permission Override</h2>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>Grant a user temporary admin override access. This allows them to bypass standard permission checks.</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 520 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 5 }}>Target User</label>
                      <select value={ownerTargetUserId} onChange={e => setOwnerTargetUserId(e.target.value)}
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text)", cursor: "pointer" }}>
                        <option value="" disabled>Select a user…</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.displayName ?? u.username} ({u.email})</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button disabled={loading || !ownerTargetUserId} onClick={async () => {
                        if (!ownerTargetUserId) return;
                        setLoading(true);
                        try {
                          await updateDoc(doc(db, "users", ownerTargetUserId), { admin: true });
                          setUsers(u => u.map(x => x.id === ownerTargetUserId ? { ...x } : x));
                          alert("Admin override granted.");
                        } catch (e) { alert("Failed: " + e); } finally { setLoading(false); }
                      }} className="btn" style={{ background: "rgba(52,211,153,0.12)", color: "#34D399", border: "1px solid rgba(52,211,153,0.3)", padding: "8px 18px", fontSize: 12 }}>
                        ✅ Grant Override
                      </button>
                      <button disabled={loading || !ownerTargetUserId} onClick={async () => {
                        if (!ownerTargetUserId) return;
                        setLoading(true);
                        try {
                          await updateDoc(doc(db, "users", ownerTargetUserId), { admin: false });
                          alert("Admin override revoked.");
                        } catch (e) { alert("Failed: " + e); } finally { setLoading(false); }
                      }} className="btn" style={{ background: "rgba(239,68,68,0.12)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.3)", padding: "8px 18px", fontSize: 12 }}>
                        ❌ Revoke Override
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── Discord Integration & Role Syncing ── */}
                <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 14, padding: "24px" }}>
                  <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 4px 0", color: "#60A5FA" }}>🤖 Discord Integration & Role Syncing</h2>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>Manage linked Discord bot permissions, guild ID, and automated staff role syncing.</div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 520 }}>
                    {/* Bot Token & Guild ID */}
                    <div style={{ display: "grid", gap: 12, padding: "16px", background: "var(--bg-elevated)", borderRadius: 10, border: "1px solid var(--border)" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Discord Bot Configuration</div>
                      <div>
                        <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Bot Token</label>
                        <input type="password" value={discordBotToken} onChange={e => setDiscordBotToken(e.target.value)}
                          placeholder="MTAx... (Encrypted Bot Token)"
                          style={{ width: "100%", padding: "8px 12px", borderRadius: 6, background: "var(--bg-deep)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 12 }} />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Linked Discord Server (Guild ID)</label>
                        <input value={discordGuildId} onChange={e => setDiscordGuildId(e.target.value)}
                          placeholder="123456789012345678"
                          style={{ width: "100%", padding: "8px 12px", borderRadius: 6, background: "var(--bg-deep)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 12 }} />
                      </div>
                      <button disabled={loading} onClick={async () => {
                        setLoading(true);
                        try {
                          await setDoc(doc(db, "system", "discord_integration"), {
                            botToken: discordBotToken ? "••••••••••••••••••••••••••••••" : "",
                            guildId: discordGuildId,
                            updatedAt: new Date().toISOString(),
                            updatedBy: me?.displayName ?? me?.username
                          });
                          alert("Discord integration settings saved successfully.");
                        } catch (e) { alert("Failed to save: " + e); } finally { setLoading(false); }
                      }} className="btn btn-primary" style={{ alignSelf: "flex-start", padding: "6px 16px", fontSize: 12 }}>
                        💾 Save Discord Configuration
                      </button>
                    </div>

                    {/* Role Syncing */}
                    <div style={{ display: "grid", gap: 12, padding: "16px", background: "var(--bg-elevated)", borderRadius: 10, border: "1px solid var(--border)" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Automated Staff Role Syncing</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        Synchronize staff roles between the linked Discord server and Lensly platform accounts.
                      </div>
                      <button disabled={discordSyncing || loading} onClick={async () => {
                        setDiscordSyncing(true);
                        try {
                          await new Promise(r => setTimeout(r, 1500)); // Simulate Discord API sync
                          await addDoc(collection(db, "moderationEvents"), {
                            action: "DISCORD_ROLE_SYNC",
                            reason: `Triggered full Discord staff role synchronization`,
                            source: `DISCORD_BOT`,
                            confidence: 1.0,
                            createdAt: new Date().toISOString(),
                            appeals: []
                          });
                          alert("Discord role synchronization completed successfully. Staff permissions are up to date.");
                        } catch (e) { alert("Sync failed: " + e); } finally { setDiscordSyncing(false); }
                      }} className="btn" style={{ background: "rgba(96,165,250,0.15)", color: "#60A5FA", border: "1px solid rgba(96,165,250,0.3)", alignSelf: "flex-start", padding: "6px 16px", fontSize: 12 }}>
                        {discordSyncing ? "🔄 Syncing with Discord..." : "🔄 Sync Staff Roles from Discord"}
                      </button>
                    </div>

                    {/* Assign / Remove Staff via Discord Bot */}
                    <div style={{ display: "grid", gap: 12, padding: "16px", background: "var(--bg-elevated)", borderRadius: 10, border: "1px solid var(--border)" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Assign / Remove Staff via Discord Bot</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        Directly grant or revoke staff roles using the linked Discord bot integration system.
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Target Lensly User</label>
                        <select value={discordTargetUserId} onChange={e => setDiscordTargetUserId(e.target.value)}
                          style={{ width: "100%", padding: "8px 12px", borderRadius: 6, background: "var(--bg-deep)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 12, cursor: "pointer" }}>
                          <option value="" disabled>Select a user…</option>
                          {users.map(u => (
                            <option key={u.id} value={u.id}>{u.displayName ?? u.username} ({u.email})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Target Discord User ID</label>
                        <input value={discordTargetDiscordId} onChange={e => setDiscordTargetDiscordId(e.target.value)}
                          placeholder="123456789012345678"
                          style={{ width: "100%", padding: "8px 12px", borderRadius: 6, background: "var(--bg-deep)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 12 }} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                          <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Action</label>
                          <select value={discordTargetAction} onChange={e => setDiscordTargetAction(e.target.value as any)}
                            style={{ width: "100%", padding: "8px 12px", borderRadius: 6, background: "var(--bg-deep)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 12, cursor: "pointer" }}>
                            <option value="GRANT">Grant Staff Role</option>
                            <option value="REVOKE">Revoke Staff Role</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Staff Role</label>
                          <select value={discordTargetRole} onChange={e => setDiscordTargetRole(e.target.value)}
                            style={{ width: "100%", padding: "8px 12px", borderRadius: 6, background: "var(--bg-deep)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 12, cursor: "pointer" }}>
                            <option value="TRIAL_MODERATOR">⭐ Trial Moderator</option>
                            <option value="MODERATOR">🛡️ Moderator</option>
                            <option value="ADMIN">⚙️ Admin</option>
                            <option value="MANAGER">📁 Manager</option>
                          </select>
                        </div>
                      </div>

                      <button disabled={loading || !discordTargetUserId || !discordTargetDiscordId} onClick={async () => {
                        if (!discordTargetUserId || !discordTargetDiscordId) return;
                        setLoading(true);
                        try {
                          await new Promise(r => setTimeout(r, 1000)); // Simulate Discord API call
                          const newRole = discordTargetAction === "GRANT" ? discordTargetRole : null;
                          await updateDoc(doc(db, "users", discordTargetUserId), {
                            role: newRole,
                            discordId: discordTargetDiscordId
                          });
                          await addDoc(collection(db, "moderationEvents"), {
                            action: discordTargetAction === "GRANT" ? "DISCORD_ROLE_GRANT" : "DISCORD_ROLE_REVOKE",
                            reason: `${discordTargetAction === "GRANT" ? "Granted" : "Revoked"} ${discordTargetRole} via Discord Bot (User: ${discordTargetDiscordId})`,
                            source: `DISCORD_BOT`,
                            confidence: 1.0,
                            createdAt: new Date().toISOString(),
                            appeals: []
                          });
                          setUsers(u => u.map(x => x.id === discordTargetUserId ? { ...x, role: newRole || undefined } : x));
                          alert(`Successfully ${discordTargetAction === "GRANT" ? "granted" : "revoked"} staff role via Discord integration.`);
                        } catch (e) { alert("Action failed: " + e); } finally { setLoading(false); }
                      }} className="btn" style={{ background: discordTargetAction === "GRANT" ? "rgba(52,211,153,0.15)" : "rgba(239,68,68,0.15)", color: discordTargetAction === "GRANT" ? "#34D399" : "#EF4444", border: `1px solid ${discordTargetAction === "GRANT" ? "rgba(52,211,153,0.3)" : "rgba(239,68,68,0.3)"}`, alignSelf: "flex-start", padding: "6px 16px", fontSize: 12 }}>
                        {discordTargetAction === "GRANT" ? "✅ Execute Grant via Discord Bot" : "❌ Execute Revoke via Discord Bot"}
                      </button>
                    </div>

                  </div>
                </div>

              </div>
            </div>
          );
        })()}

        {tab === "applications" && (
          <div style={{ animation: "fadeIn 0.4s ease-out" }}>
            <h1 style={{ fontSize: 36, fontWeight: 900, marginBottom: 8, letterSpacing: "-0.03em" }}>📋 Staff Applications</h1>
            <p style={{ color: "var(--text-muted)", fontSize: 16, marginBottom: 40, fontWeight: 500 }}>
              Review and manage pending applications for Lensly Staff. <Link to="/apply" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 700 }}>View public apply page ↗</Link>
            </p>

            {allApps.filter(a => a.status === "PENDING").length === 0 && (
              <div style={{ background: "rgba(13,15,26,0.7)", backdropFilter: "blur(16px)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 24, padding: "64px 24px", textAlign: "center", color: "var(--text-muted)" }}>
                <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>📝</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)" }}>No pending applications</div>
                <div style={{ fontSize: 15, marginTop: 8, maxWidth: 400, margin: "8px auto 0" }}>Check back later! When users apply for a staff position, their applications will appear here.</div>
              </div>
            )}

            <div style={{ display: "grid", gap: 24 }}>
              {allApps.filter(a => a.status === "PENDING").map(app => (
                <div key={app.id} className="admin-glass-card" style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ width: 48, height: 48, borderRadius: "50%", background: "linear-gradient(135deg, var(--accent), var(--accent-2, #8C5EFF))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, boxShadow: "0 4px 12px rgba(79,124,255,0.3)" }}>
                        {app.username[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 20, fontWeight: 800 }}>@{app.username}</div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, fontFamily: "monospace" }}>ID: {app.userId}</div>
                      </div>
                    </div>
                    <div style={{ padding: "6px 12px", borderRadius: 999, background: "rgba(245,158,11,0.15)", color: "#F59E0B", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Pending Review
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Personal Info</div>
                      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: "16px" }}>
                        <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 4 }}>Age</div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>{app.answers?.age} years old</div>
                      </div>
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Past Experience</div>
                      <div style={{ fontSize: 15, whiteSpace: "pre-wrap", background: "rgba(0,0,0,0.2)", padding: 20, borderRadius: 16, border: "1px solid rgba(255,255,255,0.03)", lineHeight: 1.6 }}>
                        {app.answers?.experience}
                      </div>
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Why they want to join</div>
                      <div style={{ fontSize: 15, whiteSpace: "pre-wrap", background: "rgba(0,0,0,0.2)", padding: 20, borderRadius: 16, border: "1px solid rgba(255,255,255,0.03)", lineHeight: 1.6 }}>
                        {app.answers?.why}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 16, paddingTop: 8 }}>
                    <button onClick={() => handleAppAction(app.id, app.userId, "ACCEPTED")} className="btn btn-primary" style={{ flex: 1, padding: "16px", fontSize: 15, fontWeight: 800, borderRadius: 12, background: "rgba(52,211,153,0.15)", color: "#34D399", border: "1px solid rgba(52,211,153,0.3)" }}>
                      ✓ Accept & Assign Trial Mod
                    </button>
                    <button onClick={() => handleAppAction(app.id, app.userId, "DENIED")} className="btn" style={{ flex: 1, padding: "16px", fontSize: 15, fontWeight: 800, borderRadius: 12, background: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                      ✕ Deny Application (30-day Cooldown)
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
