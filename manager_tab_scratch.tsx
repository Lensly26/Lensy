        {tab === "manager" && (
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>📁 Management Moderation & Operations Panel</h1>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>

              {/* Management Controls */}
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

                {/* Role Management Box */}
                <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 14, padding: "24px", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 16px 0", color: "var(--accent)" }}>🛡️ Enterprise Role Management Console</h2>
                  <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.5 }}>
                    Assign or revoke official staff roles across the Lensly platform. Staff roles automatically grant appropriate moderation and administrative dashboard permissions.
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--text-muted)" }}>Target User</label>
                      <select
                        value={ownerTargetUserId}
                        onChange={e => setOwnerTargetUserId(e.target.value)}
                        style={{ width: "100%", padding: "12px 16px", borderRadius: 10, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text)", cursor: "pointer", fontSize: 14 }}
                      >
                        <option value="">-- Select Target User --</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>
                            {u.displayName ? `${u.displayName} (@${u.username})` : `@${u.username}`} - {u.accountStatus} {u.role ? `[${u.role}]` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--text-muted)" }}>Select Official Staff Role</label>
                      <select
                        value={ownerTargetRole}
                        onChange={e => setOwnerTargetRole(e.target.value)}
                        style={{ width: "100%", padding: "12px 16px", borderRadius: 10, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text)", cursor: "pointer", fontSize: 14 }}
                      >
                        <option value="TRIAL_MODERATOR">Trial Moderator (Basic Moderation)</option>
                        <option value="MODERATOR">Moderator (Full Moderation)</option>
                        <option value="ADMIN">Administrator (Advanced Moderation & Config)</option>
                        <option value="MANAGER">Manager (Operations Console & Audit Logs)</option>
                        <option value="DEVELOPER">Developer (System Staging & Bot Sync)</option>
                        <option value="CO_OWNER">Co-Owner (Full Infrastructure Access)</option>
                        <option value="OWNER">Owner (Unrestricted Access)</option>
                        <option value="USER">-- Revoke Staff Role (Revert to Regular User) --</option>
                      </select>
                    </div>

                    <button
                      disabled={loading}
                      onClick={() => void handleRoleUpdate()}
                      className="btn btn-primary"
                      style={{ marginTop: 8, padding: "14px 24px", fontSize: 15, fontWeight: 700, borderRadius: 10, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer", boxShadow: "0 8px 16px rgba(79,124,255,0.25)" }}
                    >
                      {loading ? "Updating Role…" : "✨ Grant / Update Staff Role"}
                    </button>
                  </div>
                </div>

                <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 14, padding: "24px" }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 16px 0", color: "var(--accent)" }}>🛡️ User Management Console</h2>

                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--text-muted)" }}>Target User</label>
                      <select
                        value={managerUserId}
                        onChange={e => setManagerUserId(e.target.value)}
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text)", cursor: "pointer" }}
                      >
                        <option value="">-- Select Target User --</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>
                            {u.displayName ? `${u.displayName} (@${u.username})` : `@${u.username}`} - {u.accountStatus} {u.role ? `[${u.role}]` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--text-muted)" }}>Staff Notes / Case Details</label>
                      <textarea
                        value={managerReason}
                        onChange={e => setManagerReason(e.target.value)}
                        placeholder="Provide notes and details about this moderation event..."
                        style={{ width: "100%", height: 80, padding: "10px 14px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text)", resize: "none", fontFamily: "inherit", fontSize: 14 }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--text-muted)" }}>Suspension Duration (If Suspending)</label>
                      <select
                        value={managerDuration}
                        onChange={e => setManagerDuration(e.target.value)}
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text)", cursor: "pointer" }}
                      >
                        <option value="1">1 Hour</option>
                        <option value="24">1 Day</option>
                        <option value="168">1 Week</option>
                        <option value="720">1 Month</option>
                        <option value="PERMANENT">Permanent</option>
                      </select>
                    </div>

                    {/* Action Grid */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button disabled={loading} onClick={() => void handleManagerAction("WARN")} className="btn" style={{ flex: 1, background: "rgba(245,158,11,0.15)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.3)" }}>⚠️ Issue Warning</button>
                        <button disabled={loading} onClick={() => void handleManagerAction("UNWARN")} className="btn" style={{ flex: 1, background: "rgba(52,211,153,0.15)", color: "#34D399", border: "1px solid rgba(52,211,153,0.3)" }}>✅ Clear Warnings</button>
                      </div>

                      <div style={{ display: "flex", gap: 10 }}>
                        <button disabled={loading} onClick={() => void handleManagerAction("SUSPEND")} className="btn" style={{ flex: 1, background: "rgba(239,68,68,0.15)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.3)" }}>🛑 Suspend User</button>
                        <button disabled={loading} onClick={() => void handleManagerAction("UNSUSPEND")} className="btn" style={{ flex: 1, background: "rgba(52,211,153,0.15)", color: "#34D399", border: "1px solid rgba(52,211,153,0.3)" }}>✅ Lift Suspension</button>
                      </div>

                      <div style={{ display: "flex", gap: 10 }}>
                        <button disabled={loading} onClick={() => void handleManagerAction("HWID_BAN")} className="btn" style={{ flex: 1, background: "rgba(239,68,68,0.25)", color: "#EF4444", border: "1px solid #EF4444" }}>💻 HWID Ban</button>
                        <button disabled={loading} onClick={() => void handleManagerAction("UN_HWID_BAN")} className="btn" style={{ flex: 1, background: "rgba(52,211,153,0.15)", color: "#34D399", border: "1px solid rgba(52,211,153,0.3)" }}>💻 Remove HWID</button>
                      </div>

                      <div style={{ display: "flex", gap: 10 }}>
                        <button disabled={loading} onClick={() => void handleManagerAction("IP_BAN")} className="btn" style={{ flex: 1, background: "rgba(239,68,68,0.25)", color: "#EF4444", border: "1px solid #EF4444" }}>🌐 IP Ban</button>
                        <button disabled={loading} onClick={() => void handleManagerAction("UN_IP_BAN")} className="btn" style={{ flex: 1, background: "rgba(52,211,153,0.15)", color: "#34D399", border: "1px solid rgba(52,211,153,0.3)" }}>🌐 Remove IP Ban</button>
                      </div>
                    </div>

                  </div>
                </div>

                <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 14, padding: "24px" }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 16px 0", color: "var(--accent)" }}>🏢 Server Enforcement Console</h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--text-muted)" }}>Target Server (Guild) ID</label>
                      <input
                        type="text"
                        value={managerTargetGuildId}
                        onChange={e => setManagerTargetGuildId(e.target.value)}
                        placeholder="Paste Guild ID here..."
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: "monospace" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--text-muted)" }}>Action Reason / Notes</label>
                      <textarea
                        value={managerGuildReason}
                        onChange={e => setManagerGuildReason(e.target.value)}
                        placeholder="Reason for suspension, deletion, or strike..."
                        style={{ width: "100%", height: 60, padding: "10px 14px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text)", resize: "none", fontFamily: "inherit", fontSize: 14 }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button disabled={loading} onClick={() => void handleManagerGuildAction("STRIKE")} className="btn" style={{ flex: 1, background: "rgba(245,158,11,0.15)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.3)" }}>⚠️ Issue Strike</button>
                        <button disabled={loading} onClick={() => void handleManagerGuildAction("SUSPEND")} className="btn" style={{ flex: 1, background: "rgba(239,68,68,0.15)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.3)" }}>🛑 Suspend Server</button>
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button disabled={loading} onClick={() => void handleManagerGuildAction("DELETE")} className="btn" style={{ flex: 1, background: "rgba(239,68,68,0.25)", color: "#EF4444", border: "1px solid #EF4444" }}>❌ Delete Server</button>
                        <button disabled={loading} onClick={() => void handleManagerGuildAction("RESTORE")} className="btn" style={{ flex: 1, background: "rgba(52,211,153,0.15)", color: "#34D399", border: "1px solid rgba(52,211,153,0.3)" }}>✅ Restore Server</button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Server Discovery Approval Queue */}
                <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 14, padding: "24px", marginTop: 24 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#34D399" }}>🌐 Discovery Approval Queue</h2>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                        Servers requesting to be listed in the Public Discovery directory.
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--bg-elevated)", padding: "8px 16px", borderRadius: 10, border: "1px solid var(--border)" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Workflow Status:</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: systemConfig?.discoveryWorkflowEnabled ? "#34D399" : "#F59E0B" }}>
                        {systemConfig?.discoveryWorkflowEnabled ? "● ACTIVE" : "○ INACTIVE"}
                      </span>
                    </div>
                  </div>

                  {!systemConfig?.discoveryWorkflowEnabled ? (
                    <div style={{
                      background: "rgba(245, 158, 11, 0.08)",
                      border: "1px solid rgba(245, 158, 11, 0.25)",
                      borderRadius: 10,
                      padding: "16px",
                      color: "var(--text-muted)",
                      fontSize: 13,
                      lineHeight: "1.5"
                    }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8, color: "#F59E0B", fontWeight: 700 }}>
                        <span style={{ fontSize: 16 }}>⚠️</span> Discovery Questionnaire Workflow Inactive
                      </div>
                      The custom discovery questionnaire and staff review queue workflow is currently inactive. You can re-enable it directly from the Developer controls.
                    </div>
                  ) : pendingGuilds.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-muted)", fontSize: 13 }}>
                      ✨ No pending server discovery requests!
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {pendingGuilds.map((g) => (
                        <div key={g.id} style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
                            {g.iconUrl ? (
                              <img src={g.iconUrl} alt={g.name} style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
                            ) : (
                              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>
                                {g.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</div>
                              <div style={{ fontSize: 11, color: "var(--text-dim)" }}>ID: {g.id}</div>
                            </div>
                          </div>
                          {g.description && (
                            <div style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 10px", lineHeight: "1.4" }}>
                              {g.description}
                            </div>
                          )}

                          {g.discoveryRequest && (
                            <div style={{
                              margin: "8px 0 12px 0",
                              padding: "12px",
                              background: "var(--bg-panel)",
                              border: "1px solid var(--border)",
                              borderRadius: 8,
                              fontSize: 12,
                              display: "flex",
                              flexDirection: "column",
                              gap: 8
                            }}>
                              <div style={{ fontWeight: 800, color: "#34D399", borderBottom: "1px solid var(--border)", paddingBottom: 4, fontSize: 11, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
                                📋 Discovery Questionnaire
                              </div>

                              <div>
                                <span style={{ fontWeight: 700, color: "var(--text-muted)" }}>Why list this server?</span>
                                <div style={{ color: "#fff", marginTop: 2, paddingLeft: 8, borderLeft: "2px solid var(--accent)", fontStyle: "italic", whiteSpace: "pre-wrap", lineHeight: 1.4 }}>
                                  {g.discoveryRequest.whyJoin}
                                </div>
                              </div>

                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
                                <div>
                                  <span style={{ fontWeight: 700, color: "var(--text-muted)" }}>Approx. Members:</span>
                                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 13, marginTop: 2 }}>{g.discoveryRequest.memberCount}</div>
                                </div>
                                <div>
                                  <span style={{ fontWeight: 700, color: "var(--text-muted)" }}>Primary Category:</span>
                                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 13, marginTop: 2 }}>{g.discoveryRequest.category}</div>
                                </div>
                              </div>

                              {g.discoveryRequest.guidelines && (
                                <div style={{ marginTop: 4 }}>
                                  <span style={{ fontWeight: 700, color: "var(--text-muted)" }}>Rules & Review Details:</span>
                                  <div style={{ color: "#fff", marginTop: 2, paddingLeft: 8, borderLeft: "2px solid #F59E0B", fontStyle: "italic", whiteSpace: "pre-wrap", lineHeight: 1.4 }}>
                                    {g.discoveryRequest.guidelines}
                                  </div>
                                </div>
                              )}

                              {g.discoveryRequest.submittedAt && (
                                <div style={{ fontSize: 10, color: "var(--text-dim)", alignSelf: "flex-end", marginTop: 4 }}>
                                  Submitted: {new Date(g.discoveryRequest.submittedAt).toLocaleString()}
                                </div>
                              )}
                            </div>
                          )}

                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              className="btn"
                              style={{ flex: 1, padding: "6px 12px", fontSize: 12, background: "rgba(52,211,153,0.15)", color: "#34D399", border: "1px solid rgba(52,211,153,0.3)" }}
                              onClick={async () => {
                                try {
                                  await updateDoc(doc(db, "guilds", g.id), { discoveryStatus: "APPROVED", isPublic: true });
                                  alert(`Server "${g.name}" has been approved for Discovery!`);
                                } catch (err) {
                                  alert("Failed to approve server: " + String(err));
                                }
                              }}
                            >
                              ✓ Approve
                            </button>
                            <button
                              className="btn"
                              style={{ flex: 1, padding: "6px 12px", fontSize: 12, background: "rgba(239,68,68,0.15)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.3)" }}
                              onClick={async () => {
                                try {
                                  await updateDoc(doc(db, "guilds", g.id), { discoveryStatus: "REJECTED", isPublic: false });
                                  alert(`Server "${g.name}" discovery request has been rejected.`);
                                } catch (err) {
                                  alert("Failed to reject server: " + String(err));
                                }
                              }}
                            >
                              ✕ Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Management Logs / Audit Feed */}
              <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 14, padding: "24px", maxHeight: "80vh", overflowY: "auto" }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 16px 0", color: "#34D399" }}>📜 Real-time Moderation Audit Feed</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {modEvents.map((e) => (
                    <div key={e.id} style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
                          <span style={{ padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: e.action.includes("BAN") ? "rgba(239,68,68,0.25)" : "rgba(245,158,11,0.15)", color: e.action.includes("BAN") ? "#EF4444" : "#F59E0B" }}>{e.action}</span>
                          <span style={{ padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "rgba(79,124,255,0.1)", color: "var(--accent)" }}>{e.source}</span>
                        </div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Notes: {e.reason ?? "—"}</div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>{new Date(e.createdAt).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                  {modEvents.length === 0 && <div style={{ color: "var(--text-muted)", fontSize: 14, padding: "20px 0", textAlign: "center" }}>No actions logged yet.</div>}
                </div>
              </div>

            </div>
          </div>
        )}

        {tab === "developer" && (() => {
          const r = me?.role?.toUpperCase();
          if (r !== "OWNER" && r !== "CO_OWNER" && r !== "DEVELOPER") return null;
          return (
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>Developer Panel</h1>
              {hasNewGithubUpdate && (
                <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", padding: "16px 20px", borderRadius: 12, marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ fontSize: 28 }}>🚨</div>
                  <div>
                    <div style={{ color: "#F59E0B", fontWeight: 800, fontSize: 16, marginBottom: 4 }}>New Code on GitHub: Waiting for latest release</div>
                    <div style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.5 }}>A new commit was detected on GitHub. Go to the Staged Updates section below to stage or force push the new release live!</div>
                  </div>
                </div>
              )}
              <div style={{ display: "grid", gap: 24 }}>
                <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 14, padding: "24px" }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 16px 0", color: "#34D399" }}>💻 Development Controls</h2>
                  <div style={{ display: "grid", gap: 12, maxWidth: 500 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "var(--bg-elevated)", borderRadius: 8, border: "1px solid var(--border)" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>Developer Mode</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Enables experimental features and debug logs.</div>
                      </div>
                      <button onClick={() => void toggleConfig("developerMode")} className="btn" style={{ background: systemConfig?.developerMode ? "var(--accent)" : "var(--bg-deep)", color: systemConfig?.developerMode ? "#fff" : "var(--text)", transition: "all 0.2s" }}>
                        {systemConfig?.developerMode ? "Enabled" : "Disabled"}
                      </button>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "var(--bg-elevated)", borderRadius: 8, border: "1px solid var(--border)" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>Maintenance Mode</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Locks down the site for non-staff.</div>
                      </div>
                      <button onClick={() => void toggleConfig("maintenanceMode")} className="btn" style={{ background: systemConfig?.maintenanceMode ? "var(--danger)" : "var(--bg-deep)", color: systemConfig?.maintenanceMode ? "#fff" : "var(--text)", transition: "all 0.2s" }}>
                        {systemConfig?.maintenanceMode ? "Enabled" : "Disabled"}
                      </button>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "var(--bg-elevated)", borderRadius: 8, border: "1px solid var(--border)" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>Discovery Questionnaire Workflow</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Enables staff discovery request forms, approval queues, & verified system DMs.</div>
                      </div>
                      <button onClick={() => void toggleConfig("discoveryWorkflowEnabled")} className="btn" style={{ background: systemConfig?.discoveryWorkflowEnabled ? "var(--accent)" : "var(--bg-deep)", color: systemConfig?.discoveryWorkflowEnabled ? "#fff" : "var(--text)", transition: "all 0.2s" }}>
                        {systemConfig?.discoveryWorkflowEnabled ? "Enabled" : "Disabled"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Staged Updates & Rollout Scheduler */}
                <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 14, padding: "24px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px 0", color: "#06B6D4" }}>🚀 Staged System Updates & Rollout Scheduler</h2>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Stage platform updates with an automated countdown timer or force push them live instantly.</div>
                    </div>
                    {stagingData?.updatePending && !stagingData?.updateLive && (
                      <span style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>⏳ Update Staged & Counting Down</span>
                    )}
                    {stagingData?.updateLive && (
                      <span style={{ background: "rgba(52,211,153,0.15)", color: "#34D399", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>🎉 Update is LIVE</span>
                    )}
                  </div>

                  <div style={{ display: "grid", gap: 20, maxWidth: 600 }}>
                    {stagingData?.updatePending && !stagingData?.updateLive ? (
                      <div style={{ background: "var(--bg-elevated)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 12, padding: "20px" }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 8px 0", color: "#F59E0B" }}>{stagingData.version}</h3>
                        <p style={{ fontSize: 13, color: "var(--text)", margin: "0 0 16px 0", lineHeight: 1.4 }}>{stagingData.description}</p>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
                          Scheduled Live Time: {new Date(stagingData.scheduledTime).toLocaleString()}
                        </div>
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                          <button onClick={() => void forcePushUpdateLive()} className="btn btn-primary" style={{ background: "#10B981", color: "#fff", fontWeight: 700, padding: "10px 20px" }}>
                            🚀 Force Push Update Live Now
                          </button>
                          <button onClick={() => void cancelStagedUpdate()} className="btn btn-ghost" style={{ color: "var(--danger)" }}>
                            Cancel Staged Update
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <div>
                          <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 5 }}>Update Version Title</label>
                          <input value={stagedVersion} onChange={e => setStagedVersion(e.target.value)} placeholder="e.g. v2.4.0 - Lensly Premium & Shop Expansion"
                            style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text)" }} />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 5 }}>Update Description / Changelog</label>
                          <textarea value={stagedDescription} onChange={e => setStagedDescription(e.target.value)} rows={3} placeholder="Describe the new features, bug fixes, or maintenance changes..."
                            style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text)", resize: "vertical" }} />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 5 }}>Automated Rollout Countdown</label>
                          <select value={stagedMinutes} onChange={e => setStagedMinutes(e.target.value)}
                            style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text)", cursor: "pointer" }}>
                            <option value="5">5 Minutes</option>
                            <option value="15">15 Minutes</option>
                            <option value="30">30 Minutes</option>
                            <option value="60">1 Hour</option>
                            <option value="120">2 Hours</option>
                          </select>
                        </div>
                        <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                          <button onClick={() => void stageNewUpdate()} className="btn btn-primary" style={{ padding: "10px 24px", fontWeight: 700 }}>
                            ⏳ Stage Update & Start Timer
                          </button>
                          {stagingData?.updateLive && (
                            <button onClick={() => void cancelStagedUpdate()} className="btn btn-ghost" style={{ color: "var(--text-muted)" }}>
                              Clear Live Update Banner
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
                    📅 <b>Official Lensly Release Schedule:</b> Major feature updates roll out every Friday. Bug fixes and minor patches roll out daily.
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

