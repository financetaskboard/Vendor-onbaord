import { useState, useEffect, useCallback } from "react";

// ── SERVER BASE — same pattern as TDS app ──────────────────────
const SERVER_BASE = window.location.origin;

// ── API helpers ────────────────────────────────────────────────
const api = {
  get:  (url)       => fetch(SERVER_BASE + url).then(r => r.json()),
  post: (url, body) => fetch(SERVER_BASE + url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(r => r.json()),
};

// ═══════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════
const S = {
  // Layout
  layout:    { display:"flex", minHeight:"100vh" },
  sidebar:   { width:230, background:"#171921", borderRight:"1px solid #2e3040", display:"flex", flexDirection:"column", position:"fixed", top:0, left:0, height:"100vh", zIndex:100 },
  main:      { marginLeft:230, flex:1, padding:"32px 36px", minHeight:"100vh" },
  // Sidebar
  logoWrap:  { padding:"20px", borderBottom:"1px solid #2e3040" },
  logoTitle: { fontSize:13, fontWeight:600, color:"#e8eaf0", letterSpacing:".05em", textTransform:"uppercase" },
  logoSub:   { fontSize:11, color:"#5c6178", marginTop:2, fontFamily:"'IBM Plex Mono',monospace" },
  nav:       { padding:"12px 10px", flex:1 },
  navItem:   (active) => ({
    display:"flex", alignItems:"center", gap:10, padding:"8px 12px",
    borderRadius:6, cursor:"pointer", color: active ? "#e8eaf0" : "#9ca3b8",
    fontSize:13, background: active ? "#252731" : "transparent",
    border:"none", width:"100%", textAlign:"left", fontFamily:"inherit",
    fontWeight: active ? 500 : 400, transition:"all .15s",
  }),
  navDot:    (active, color) => ({
    width:6, height:6, borderRadius:"50%", flexShrink:0,
    background: active ? (color || "#22c55e") : "#2e3040",
  }),
  sideBot:   { padding:"14px 20px", borderTop:"1px solid #2e3040" },
  connBadge: { display:"flex", alignItems:"center", gap:8, fontSize:12, color:"#5c6178", padding:"4px 0" },
  connDot:   (ok) => ({
    width:7, height:7, borderRadius:"50%", flexShrink:0,
    background: ok ? "#22c55e" : "#f87171",
    boxShadow: ok ? "0 0 6px rgba(34,197,94,.4)" : "none",
  }),
  // Page header
  pageHdr:   { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:28 },
  pageTitle: { fontSize:22, fontWeight:600, color:"#e8eaf0", letterSpacing:"-.02em" },
  pageSub:   { fontSize:13, color:"#5c6178", marginTop:4, fontFamily:"'IBM Plex Mono',monospace" },
  // Cards
  card:      { background:"#171921", border:"1px solid #2e3040", borderRadius:10, marginBottom:16, overflow:"hidden" },
  cardHdr:   { padding:"14px 20px", borderBottom:"1px solid #2e3040", display:"flex", alignItems:"center", justifyContent:"space-between" },
  cardTitle: { fontSize:12, fontWeight:600, color:"#e8eaf0", textTransform:"uppercase", letterSpacing:".06em" },
  cardBody:  { padding:20 },
  // Stats
  statsRow:  { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:24 },
  statCard:  (accent) => ({
    background: accent ? accent + "10" : "#171921",
    border:"1px solid " + (accent ? accent + "30" : "#2e3040"),
    borderRadius:10, padding:"14px 18px",
  }),
  statLbl:   { fontSize:11, color:"#5c6178", textTransform:"uppercase", letterSpacing:".06em", marginBottom:6, fontWeight:500 },
  statNum:   (accent) => ({ fontSize:26, fontWeight:600, color: accent || "#e8eaf0", fontFamily:"'IBM Plex Mono',monospace", letterSpacing:"-.02em" }),
  // Form
  formGrid:  { display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 },
  formGrp:   { display:"flex", flexDirection:"column", gap:5 },
  formFull:  { display:"flex", flexDirection:"column", gap:5, gridColumn:"1/-1" },
  formLbl:   { fontSize:11, fontWeight:500, color:"#5c6178", textTransform:"uppercase", letterSpacing:".05em" },
  formInput: { background:"#1e2029", border:"1px solid #2e3040", borderRadius:6, padding:"9px 12px", color:"#e8eaf0", fontSize:13, outline:"none", width:"100%" },
  formHint:  { fontSize:11, color:"#5c6178", marginTop:3, lineHeight:1.5 },
  // Buttons
  btn: (variant, sm) => {
    const base = { display:"inline-flex", alignItems:"center", gap:7, padding: sm ? "5px 12px" : "9px 16px", borderRadius:6, fontSize: sm ? 12 : 13, fontWeight:500, cursor:"pointer", border:"none", fontFamily:"inherit", transition:"all .15s", whiteSpace:"nowrap" };
    if (variant === "primary") return { ...base, background:"#60a5fa", color:"#000" };
    if (variant === "green")   return { ...base, background:"#22c55e", color:"#000" };
    if (variant === "ghost")   return { ...base, background:"transparent", color:"#9ca3b8", border:"1px solid #2e3040" };
    if (variant === "danger")  return { ...base, background:"transparent", color:"#f87171", border:"1px solid rgba(248,113,113,.2)" };
    if (variant === "amber")   return { ...base, background:"transparent", color:"#f59e0b", border:"1px solid rgba(245,158,11,.2)" };
    return base;
  },
  btnDisabled: { opacity:.4, cursor:"not-allowed" },
  // Badges
  badge: (type) => {
    const base = { display:"inline-flex", alignItems:"center", gap:5, padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:500 };
    if (type === "green")  return { ...base, background:"rgba(34,197,94,.08)",  color:"#22c55e",  border:"1px solid rgba(34,197,94,.2)" };
    if (type === "amber")  return { ...base, background:"rgba(245,158,11,.08)", color:"#f59e0b",  border:"1px solid rgba(245,158,11,.2)" };
    if (type === "blue")   return { ...base, background:"rgba(96,165,250,.08)", color:"#60a5fa",  border:"1px solid rgba(96,165,250,.2)" };
    if (type === "red")    return { ...base, background:"rgba(248,113,113,.08)",color:"#f87171",  border:"1px solid rgba(248,113,113,.2)" };
    return base;
  },
  // Alerts
  alert: (type) => {
    const base = { padding:"11px 16px", borderRadius:8, fontSize:13, display:"flex", alignItems:"flex-start", gap:10, marginBottom:14, lineHeight:1.5 };
    if (type === "green") return { ...base, background:"rgba(34,197,94,.08)",  color:"#22c55e",  border:"1px solid rgba(34,197,94,.2)" };
    if (type === "amber") return { ...base, background:"rgba(245,158,11,.08)", color:"#f59e0b",  border:"1px solid rgba(245,158,11,.2)" };
    if (type === "red")   return { ...base, background:"rgba(248,113,113,.08)",color:"#f87171",  border:"1px solid rgba(248,113,113,.2)" };
    if (type === "blue")  return { ...base, background:"rgba(96,165,250,.08)", color:"#60a5fa",  border:"1px solid rgba(96,165,250,.2)" };
    return base;
  },
  // Vendor cards
  vcCard: (type) => ({
    background:"#171921",
    border:"1px solid #2e3040",
    borderLeft:`3px solid ${type === "created" ? "#60a5fa" : type === "approved" ? "#22c55e" : "#f59e0b"}`,
    borderRadius:10, marginBottom:10, overflow:"hidden",
  }),
  vcHeader: { padding:"14px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, cursor:"pointer" },
  vcLeft:   { display:"flex", alignItems:"center", gap:14, minWidth:0, flex:1 },
  vcAvatar: { width:36, height:36, borderRadius:8, background:"#252731", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:600, color:"#a78bfa", flexShrink:0, border:"1px solid #2e3040" },
  vcName:   { fontSize:14, fontWeight:500, color:"#e8eaf0" },
  vcMeta:   { fontSize:12, color:"#5c6178", fontFamily:"'IBM Plex Mono',monospace", marginTop:2 },
  vcRight:  { display:"flex", alignItems:"center", gap:8, flexShrink:0 },
  // Detail grid
  detGrid:  { display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:20, padding:"0 20px 18px", borderTop:"1px solid #2e3040", paddingTop:16, marginTop:0 },
  detSecTitle: { fontSize:10, fontWeight:600, textTransform:"uppercase", letterSpacing:".08em", color:"#5c6178", marginBottom:10, paddingBottom:6, borderBottom:"1px solid #2e3040" },
  detRow:   { display:"flex", justifyContent:"space-between", gap:8, padding:"3px 0" },
  detKey:   { fontSize:11, color:"#5c6178", flexShrink:0 },
  detVal:   { fontSize:11, color:"#e8eaf0", fontFamily:"'IBM Plex Mono',monospace", textAlign:"right", wordBreak:"break-all" },
  // Empty state
  empty:    { padding:"48px 0", textAlign:"center", color:"#5c6178" },
  emptyIcon:{ fontSize:28, marginBottom:10, opacity:.4 },
  // Spinner
  spinWrap: { display:"inline-flex", alignItems:"center", gap:8, color:"#9ca3b8", fontSize:13 },
  // Code block
  codeBlock:{ background:"#1e2029", border:"1px solid #2e3040", borderRadius:6, padding:"12px 14px", fontFamily:"'IBM Plex Mono',monospace", fontSize:12, color:"#9ca3b8", whiteSpace:"pre", overflowX:"auto", marginTop:8 },
};

// Spinner component
function Spinner() {
  return (
    <div style={{ width:14, height:14, border:"2px solid #2e3040", borderTopColor:"#60a5fa", borderRadius:"50%", animation:"spin .7s linear infinite" }}/>
  );
}

// Badge dot helper
function BDot() {
  return <span style={{ width:5, height:5, borderRadius:"50%", background:"currentColor", display:"inline-block" }}/>;
}

// ═══════════════════════════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [tab, setTab]             = useState("dashboard");
  const [gmailOk, setGmailOk]     = useState(false);
  const [odooOk, setOdooOk]       = useState(false);
  const [vendors, setVendors]     = useState([]);
  const [scanning, setScanning]   = useState(false);
  const [scanMsg, setScanMsg]     = useState("Click Scan Gmail to fetch vendor approval emails");
  const [alert, setAlert]         = useState(null);
  const [expanded, setExpanded]   = useState({});
  const [creating, setCreating]   = useState({});
  const [created, setCreated]     = useState({});   // { reqNum: { odooId, link } }
  // Settings form
  const [cfg, setCfg]             = useState({ googleClientId:"", googleClientSecret:"", emailSubject:"for your review", odooUrl:"", odooDb:"", odooUsername:"", odooPassword:"" });
  const [savingCfg, setSavingCfg] = useState(false);
  const [testingOdoo, setTestingOdoo] = useState(false);
  const [odooTestMsg, setOdooTestMsg] = useState(null);

  // Inject spinner keyframe
  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = "@keyframes spin{to{transform:rotate(360deg)}}";
    document.head.appendChild(s);
  }, []);

  // On load — check status + URL params
  useEffect(() => {
    checkGmailStatus();
    loadConfig();
    const p = new URLSearchParams(location.search);
    if (p.get("connected") === "true") { showAlert("Gmail connected successfully!", "green"); history.replaceState({}, "", "/"); }
    if (p.get("error"))                { showAlert("Gmail error: " + decodeURIComponent(p.get("error")), "red"); history.replaceState({}, "", "/"); }
  }, []);

  async function checkGmailStatus() {
    try {
      const d = await api.get("/api/gmail/status");
      setGmailOk(!!d.connected);
    } catch(_) {}
  }

  async function loadConfig() {
    try {
      const d = await api.get("/api/config");
      setCfg(prev => ({ ...prev, ...d }));
      if (d.odooUrl) setOdooOk(true);
    } catch(_) {}
  }

  function showAlert(msg, type, ms = 5000) {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), ms);
  }

  // ── Settings save
  async function saveGoogleCfg() {
    setSavingCfg(true);
    try {
      const body = { googleClientId: cfg.googleClientId, emailSubject: cfg.emailSubject };
      if (cfg.googleClientSecret && !cfg.googleClientSecret.includes("•")) body.googleClientSecret = cfg.googleClientSecret;
      await api.post("/api/config", body);
      showAlert("Google config saved. Now click Connect Gmail below.", "green");
    } catch(e) { showAlert(e.message, "red"); }
    setSavingCfg(false);
  }

  async function saveOdooCfg() {
    setSavingCfg(true);
    try {
      const body = { odooUrl: cfg.odooUrl.replace(/\/$/, ""), odooDb: cfg.odooDb, odooUsername: cfg.odooUsername };
      if (cfg.odooPassword && !cfg.odooPassword.includes("•")) body.odooPassword = cfg.odooPassword;
      await api.post("/api/config", body);
      setOdooOk(true);
      showAlert("Odoo config saved.", "green");
    } catch(e) { showAlert(e.message, "red"); }
    setSavingCfg(false);
  }

  async function testOdooConn() {
    setTestingOdoo(true);
    setOdooTestMsg(null);
    try {
      const d = await api.post("/api/odoo/test", {});
      if (d.ok) { setOdooTestMsg({ type:"green", msg:"✅ Connected — Odoo UID: " + d.uid }); setOdooOk(true); }
      else       setOdooTestMsg({ type:"red", msg:"❌ " + d.error });
    } catch(e) { setOdooTestMsg({ type:"red", msg:"❌ " + e.message }); }
    setTestingOdoo(false);
  }

  async function disconnectGmail() {
    if (!confirm("Disconnect Gmail?")) return;
    await api.post("/api/gmail/disconnect", {});
    setGmailOk(false);
    showAlert("Gmail disconnected.", "amber");
  }

  // ── Scan Gmail
  async function scanGmail() {
    setScanning(true);
    setScanMsg("Connecting to Gmail...");
    setVendors([]);
    setCreated({});
    setAlert(null);
    try {
      const d = await api.get("/api/gmail/scan");
      if (d.error) {
        if (d.authExpired) { setGmailOk(false); showAlert("Gmail session expired — reconnect in Settings.", "amber"); }
        else showAlert(d.error, "red");
        setScanMsg("Scan failed.");
        return;
      }
      const list = d.vendors || [];
      setVendors(list);
      const approved = list.filter(v => v.fullyApproved).length;
      setScanMsg(`Found ${list.length} request(s) — ${approved} fully approved, ${list.length - approved} awaiting 2nd approval`);
      if (list.length === 0)   showAlert("No matching emails found. Check subject in Settings.", "amber");
      else if (approved > 0)   showAlert(`${approved} vendor(s) ready to create in Odoo.`, "green");
    } catch(e) {
      setScanMsg("Error: " + e.message);
      showAlert(e.message, "red");
    }
    setScanning(false);
  }

  // ── Create vendor in Odoo
  async function createVendor(reqNum) {
    const vendor = vendors.find(v => v.requestNumber === reqNum);
    if (!vendor) return;
    setCreating(p => ({ ...p, [reqNum]: true }));
    try {
      const d = await api.post("/api/odoo/create-vendor", vendor);
      if (d.ok) {
        // Build a detailed result summary
        const attTotal    = (d.attachmentResults || []).length;
        const attUploaded = (d.attachmentResults || []).filter(r => r.ok).length;
        const attFailed   = (d.attachmentResults || []).filter(r => !r.ok);
        const bankOk      = !d.bankWarnings?.length;

        let msg = `✅ ${vendor.companyName} created in Odoo (ID: ${d.odooId})`;
        if (attTotal > 0)    msg += ` · 📎 ${attUploaded}/${attTotal} files uploaded`;
        if (attTotal === 0)  msg += ` · 📎 No attachments found in email`;
        if (!bankOk)         msg += ` · ⚠ Bank: ${d.bankWarnings[0]}`;
        if (attFailed.length) msg += ` · ✗ Failed: ${attFailed.map(r=>r.filename).join(", ")}`;

        setCreated(p => ({ ...p, [reqNum]: {
          odooId: d.odooId,
          link:   d.odooLink,
          attUploaded,
          attTotal,
          attFailed: attFailed.map(r => r.filename),
          bankOk,
        }}));
        showAlert(msg, attFailed.length || !bankOk ? "amber" : "green", 10000);
      } else {
        throw new Error(d.error || "Unknown error");
      }
    } catch(e) {
      showAlert("Failed: " + e.message, "red", 8000);
    }
    setCreating(p => ({ ...p, [reqNum]: false }));
  }

  const totalApproved = vendors.filter(v => v.fullyApproved && !created[v.requestNumber]).length;
  const totalPending  = vendors.filter(v => !v.fullyApproved).length;
  const totalCreated  = Object.keys(created).length;

  // ═══════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════
  return (
    <div style={S.layout}>
      {/* ── Sidebar ── */}
      <aside style={S.sidebar}>
        <div style={S.logoWrap}>
          <div style={S.logoTitle}>Vendor Portal</div>
          <div style={S.logoSub}>Gmail → Odoo</div>
        </div>
        <nav style={S.nav}>
          {[
            { id:"dashboard", label:"Dashboard" },
            { id:"settings",  label:"Settings" },
            { id:"guide",     label:"Setup Guide" },
          ].map(({ id, label }) => (
            <button key={id} style={S.navItem(tab === id)} onClick={() => setTab(id)}>
              <span style={S.navDot(tab === id)}/>
              {label}
            </button>
          ))}
        </nav>
        <div style={S.sideBot}>
          <div style={S.connBadge}>
            <div style={S.connDot(gmailOk)}/>
            <span>Gmail: {gmailOk ? "connected" : "not connected"}</span>
          </div>
          <div style={{ ...S.connBadge, marginTop:4 }}>
            <div style={S.connDot(odooOk)}/>
            <span>Odoo: {odooOk ? "configured" : "not set"}</span>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={S.main}>

        {/* ─ Alert ─ */}
        {alert && (
          <div style={S.alert(alert.type)}>{alert.msg}</div>
        )}

        {/* ══ DASHBOARD ══ */}
        {tab === "dashboard" && (
          <>
            <div style={S.pageHdr}>
              <div>
                <div style={S.pageTitle}>Vendor Approvals</div>
                <div style={S.pageSub}>Auto-detect approved vendors · push to Odoo</div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button style={S.btn("ghost")} onClick={() => setTab("settings")}>⚙ Settings</button>
                <button
                  style={{ ...S.btn("primary"), ...(scanning ? S.btnDisabled : {}) }}
                  disabled={scanning}
                  onClick={scanGmail}
                >
                  {scanning ? <Spinner/> : null}
                  {scanning ? "Scanning..." : "Scan Gmail"}
                </button>
              </div>
            </div>

            {/* Stats */}
            {vendors.length > 0 && (
              <div style={S.statsRow}>
                <div style={S.statCard()}><div style={S.statLbl}>Total Found</div><div style={S.statNum()}>{vendors.length}</div></div>
                <div style={S.statCard("#22c55e")}><div style={S.statLbl}>Both Approved</div><div style={S.statNum("#22c55e")}>{totalApproved}</div></div>
                <div style={S.statCard("#f59e0b")}><div style={S.statLbl}>Awaiting 2nd</div><div style={S.statNum("#f59e0b")}>{totalPending}</div></div>
                <div style={S.statCard("#60a5fa")}><div style={S.statLbl}>Created in Odoo</div><div style={S.statNum("#60a5fa")}>{totalCreated}</div></div>
              </div>
            )}

            {/* Gmail warning */}
            {!gmailOk && (
              <div style={S.alert("amber")}>
                ⚠ Gmail not connected —{" "}
                <a href="/auth/start" style={{ color:"inherit", fontWeight:600, textDecoration:"underline" }}>click here to connect Gmail</a>
                {" "}or go to Settings
              </div>
            )}

            {/* Scan status */}
            <div style={{ fontSize:13, color:"#5c6178", fontFamily:"'IBM Plex Mono',monospace", marginBottom:20, display:"flex", alignItems:"center", gap:10 }}>
              {scanning && <Spinner/>}
              {scanMsg}
            </div>

            {/* Vendor list */}
            {vendors.length === 0
              ? (
                <div style={S.empty}>
                  <div style={S.emptyIcon}>📬</div>
                  <div style={{ fontSize:14 }}>No vendors scanned yet</div>
                  <div style={{ fontSize:12, marginTop:6, fontFamily:"'IBM Plex Mono',monospace" }}>Configure settings then click Scan Gmail</div>
                </div>
              )
              : vendors.map(v => {
                  const isCreated  = !!created[v.requestNumber];
                  const isCreating = !!creating[v.requestNumber];
                  const type       = isCreated ? "created" : v.fullyApproved ? "approved" : "pending";
                  const initials   = (v.companyName || "V").split(/\s+/).slice(0,2).map(w => w[0]).join("").toUpperCase();
                  const isOpen     = !!expanded[v.requestNumber];

                  return (
                    <div key={v.requestNumber} style={S.vcCard(type)}>
                      <div
                        style={S.vcHeader}
                        onClick={() => setExpanded(p => ({ ...p, [v.requestNumber]: !p[v.requestNumber] }))}
                      >
                        <div style={S.vcLeft}>
                          <div style={S.vcAvatar}>{initials}</div>
                          <div style={{ minWidth:0 }}>
                            <div style={S.vcName}>{v.companyName || "Unknown company"}</div>
                            <div style={S.vcMeta}>
                              Req #{v.requestNumber} · {v.emailCount} email(s) · {v.gstin || "No GST"}{v.city ? " · " + v.city : ""}
                            </div>
                          </div>
                        </div>
                        <div style={S.vcRight} onClick={e => e.stopPropagation()}>
                          {isCreated
                            ? <span style={S.badge("blue")}><BDot/> Created in Odoo</span>
                            : v.fullyApproved
                              ? <span style={S.badge("green")}><BDot/> Both Approved</span>
                              : <span style={S.badge("amber")}><BDot/> Awaiting 2nd</span>
                          }
                          {isCreated ? (
                            <a href={created[v.requestNumber].link} target="_blank" rel="noreferrer" style={S.btn("ghost", true)}>
                              Open in Odoo ↗
                            </a>
                          ) : v.fullyApproved ? (
                            <button
                              style={{ ...S.btn("green", true), ...(isCreating ? S.btnDisabled : {}) }}
                              disabled={isCreating}
                              onClick={() => createVendor(v.requestNumber)}
                            >
                              {isCreating ? <Spinner/> : null}
                              {isCreating ? "Creating..." : "Create in Odoo"}
                            </button>
                          ) : (
                            <button style={{ ...S.btn("ghost", true), ...S.btnDisabled }} disabled>Awaiting 2nd approval</button>
                          )}
                          <span style={{ color:"#5c6178", fontSize:16, padding:"0 4px", transform: isOpen ? "rotate(90deg)" : "none", transition:".15s", display:"inline-block" }}>›</span>
                        </div>
                      </div>

                      {isOpen && (
                        <div style={{ borderTop:"1px solid #2e3040" }}>
                          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:20, padding:"16px 20px 18px" }}>
                            {[
                              { title:"Company & GST", rows:[
                                ["Vendor Code", v.vendorCode], ["Official Email", v.officialEmail],
                                ["GST No.", v.gstin], ["PAN", v.pan],
                                ["GST Type", v.gstTaxpayerType], ["Filing Freq.", v.gstFilingFrequency],
                                ["MSME No.", v.msmeNo], ["MSME Status", v.msmeStatus],
                              ]},
                              { title:"Contact & Address", rows:[
                                ["Contact", v.contactName], ["Designation", v.designation],
                                ["Phone", v.contactPhone], ["Email", v.contactEmail],
                                ["Street", v.address], ["City", v.city],
                                ["State", v.state], ["PIN", v.pinCode],
                              ]},
                              { title:"Bank Details", rows:[
                                ["Bank", v.bankName], ["Holder", v.accountHolderName],
                                ["A/C No.", v.accountNumber], ["Type", v.accountType],
                                ["IFSC", v.ifscCode], ["Branch", v.branch],
                              ]},
                            ].map(sec => (
                              <div key={sec.title}>
                                <div style={S.detSecTitle}>{sec.title}</div>
                                {sec.rows.filter(([,v]) => v && v !== "NA").map(([k, val]) => (
                                  <div key={k} style={S.detRow}>
                                    <span style={S.detKey}>{k}</span>
                                    <span style={S.detVal}>{val}</span>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                          {isCreated && (
                            <div style={{ padding:"0 20px 14px" }}>
                              <a href={created[v.requestNumber].link} target="_blank" rel="noreferrer"
                                style={{ fontSize:12, color:"#60a5fa", fontFamily:"'IBM Plex Mono',monospace", display:"inline-flex", alignItems:"center", gap:5 }}>
                                ⟶ Open vendor in Odoo (ID: {created[v.requestNumber].odooId})
                              </a>
                              {created[v.requestNumber].attTotal > 0 && (
                                <div style={{ fontSize:11, color: created[v.requestNumber].attFailed?.length ? "#f59e0b" : "#22c55e", marginTop:6, fontFamily:"'IBM Plex Mono',monospace" }}>
                                  📎 {created[v.requestNumber].attUploaded}/{created[v.requestNumber].attTotal} attachments uploaded to Odoo
                                  {created[v.requestNumber].attFailed?.length > 0 && (
                                    <span style={{ color:"#f87171" }}> · Failed: {created[v.requestNumber].attFailed.join(", ")}</span>
                                  )}
                                </div>
                              )}
                              {created[v.requestNumber].attTotal === 0 && (
                                <div style={{ fontSize:11, color:"#5c6178", marginTop:6, fontFamily:"'IBM Plex Mono',monospace" }}>
                                  📎 No attachments found in email
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
            }
          </>
        )}

        {/* ══ SETTINGS ══ */}
        {tab === "settings" && (
          <>
            <div style={S.pageHdr}>
              <div>
                <div style={S.pageTitle}>Settings</div>
                <div style={S.pageSub}>Configure Gmail OAuth and Odoo credentials</div>
              </div>
            </div>

            {/* Gmail */}
            <div style={S.card}>
              <div style={S.cardHdr}>
                <span style={S.cardTitle}>Gmail Connection</span>
                <span style={S.badge(gmailOk ? "green" : "amber")}><BDot/> {gmailOk ? "Connected" : "Not connected"}</span>
              </div>
              <div style={S.cardBody}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, gap:16 }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:500, color:"#e8eaf0" }}>Google OAuth2</div>
                    <div style={{ fontSize:12, color:"#5c6178", marginTop:4 }}>Read-only Gmail access. Tokens stored server-side in Firebase.</div>
                  </div>
                  <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                    <a href="/auth/start" style={S.btn("primary")}>{gmailOk ? "Reconnect Gmail" : "Connect Gmail"}</a>
                    {gmailOk && <button style={S.btn("danger", true)} onClick={disconnectGmail}>Disconnect</button>}
                  </div>
                </div>
                <div style={S.formGrid}>
                  <div style={S.formGrp}>
                    <label style={S.formLbl}>Google Client ID</label>
                    <input style={S.formInput} value={cfg.googleClientId} onChange={e => setCfg(p=>({...p,googleClientId:e.target.value}))} placeholder="xxxxxx.apps.googleusercontent.com"/>
                  </div>
                  <div style={S.formGrp}>
                    <label style={S.formLbl}>Google Client Secret</label>
                    <input style={S.formInput} type="password" value={cfg.googleClientSecret} onChange={e => setCfg(p=>({...p,googleClientSecret:e.target.value}))} placeholder="GOCSPX-xxxxxxx"/>
                  </div>
                  <div style={S.formFull}>
                    <label style={S.formLbl}>Email subject keyword</label>
                    <input style={S.formInput} value={cfg.emailSubject} onChange={e => setCfg(p=>({...p,emailSubject:e.target.value}))} placeholder="for your review"/>
                    <span style={S.formHint}>Partial match — "for your review" will match "Request #133 for your review"</span>
                  </div>
                </div>
                <button style={{ ...S.btn("ghost"), marginTop:14, ...(savingCfg ? S.btnDisabled : {}) }} disabled={savingCfg} onClick={saveGoogleCfg}>
                  {savingCfg ? <Spinner/> : null} Save Google Config
                </button>
              </div>
            </div>

            {/* Odoo */}
            <div style={S.card}>
              <div style={S.cardHdr}>
                <span style={S.cardTitle}>Odoo Configuration</span>
                <span style={S.badge(odooOk ? "green" : "amber")}><BDot/> {odooOk ? "Configured" : "Not set"}</span>
              </div>
              <div style={S.cardBody}>
                <div style={S.formGrid}>
                  <div style={S.formGrp}>
                    <label style={S.formLbl}>Odoo URL</label>
                    <input style={S.formInput} value={cfg.odooUrl} onChange={e => setCfg(p=>({...p,odooUrl:e.target.value}))} placeholder="https://ginesys.odoo.com"/>
                  </div>
                  <div style={S.formGrp}>
                    <label style={S.formLbl}>Database Name</label>
                    <input style={S.formInput} value={cfg.odooDb} onChange={e => setCfg(p=>({...p,odooDb:e.target.value}))} placeholder="ginesys"/>
                  </div>
                  <div style={S.formGrp}>
                    <label style={S.formLbl}>Username (email)</label>
                    <input style={S.formInput} value={cfg.odooUsername} onChange={e => setCfg(p=>({...p,odooUsername:e.target.value}))} placeholder="you@ginesys.com"/>
                  </div>
                  <div style={S.formGrp}>
                    <label style={S.formLbl}>Password</label>
                    <input style={S.formInput} type="password" value={cfg.odooPassword} onChange={e => setCfg(p=>({...p,odooPassword:e.target.value}))} placeholder="Your Odoo password"/>
                  </div>
                </div>
                <div style={{ display:"flex", gap:10, marginTop:14, alignItems:"center", flexWrap:"wrap" }}>
                  <button style={{ ...S.btn("ghost"), ...(savingCfg ? S.btnDisabled : {}) }} disabled={savingCfg} onClick={saveOdooCfg}>
                    {savingCfg ? <Spinner/> : null} Save Odoo Config
                  </button>
                  <button style={{ ...S.btn("ghost"), ...(testingOdoo ? S.btnDisabled : {}) }} disabled={testingOdoo} onClick={testOdooConn}>
                    {testingOdoo ? <Spinner/> : null} Test Connection
                  </button>
                  {odooTestMsg && <div style={S.alert(odooTestMsg.type)}>{odooTestMsg.msg}</div>}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ══ GUIDE ══ */}
        {tab === "guide" && (
          <>
            <div style={S.pageHdr}>
              <div>
                <div style={S.pageTitle}>Setup Guide</div>
                <div style={S.pageSub}>Deploy to Railway via GitHub in 20 minutes</div>
              </div>
            </div>
            <div style={S.card}>
              <div style={S.cardBody}>
                {[
                  { color:"#22c55e", step:"STEP 1 — Push to GitHub", content:(
                    <>
                      <div style={{ fontSize:13, color:"#9ca3b8", marginBottom:8 }}>Create a new GitHub repo and push this project:</div>
                      <div style={S.codeBlock}>{`git init
git add .
git commit -m "initial"
git remote add origin https://github.com/yourname/vendor-approval-odoo
git push -u origin main`}</div>
                    </>
                  )},
                  { color:"#f59e0b", step:"STEP 2 — Setup Firebase (for config storage)", content:(
                    <>
                      <div style={{ fontSize:13, color:"#9ca3b8", lineHeight:1.7 }}>
                        1. Go to <span style={{ color:"#60a5fa", fontFamily:"'IBM Plex Mono',monospace" }}>console.firebase.google.com</span><br/>
                        2. New project → Firestore Database → Start in production<br/>
                        3. Project Settings → Service Accounts → Generate new private key → download JSON<br/>
                        4. You'll need: <span style={{ color:"#60a5fa", fontFamily:"'IBM Plex Mono',monospace" }}>project_id</span>, <span style={{ color:"#60a5fa", fontFamily:"'IBM Plex Mono',monospace" }}>client_email</span>, <span style={{ color:"#60a5fa", fontFamily:"'IBM Plex Mono',monospace" }}>private_key</span>
                      </div>
                    </>
                  )},
                  { color:"#60a5fa", step:"STEP 3 — Get Google OAuth credentials", content:(
                    <>
                      <div style={{ fontSize:13, color:"#9ca3b8", lineHeight:1.7 }}>
                        1. <span style={{ color:"#60a5fa", fontFamily:"'IBM Plex Mono',monospace" }}>console.cloud.google.com</span> → New project → Enable Gmail API<br/>
                        2. APIs &amp; Services → Credentials → OAuth 2.0 Client ID → Web application<br/>
                        3. Authorised redirect URI: <span style={{ color:"#60a5fa", fontFamily:"'IBM Plex Mono',monospace" }}>https://YOUR-APP.railway.app/auth/callback</span><br/>
                        4. Copy Client ID + Secret → paste in app Settings
                      </div>
                    </>
                  )},
                  { color:"#a78bfa", step:"STEP 4 — Deploy on Railway", content:(
                    <>
                      <div style={{ fontSize:13, color:"#9ca3b8", lineHeight:1.7, marginBottom:8 }}>
                        1. <span style={{ color:"#60a5fa", fontFamily:"'IBM Plex Mono',monospace" }}>railway.app</span> → New project → Deploy from GitHub repo<br/>
                        2. Set these environment variables in Railway dashboard:
                      </div>
                      <div style={S.codeBlock}>{`FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@xxx.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nxxx\\n-----END PRIVATE KEY-----\\n"
SESSION_SECRET=any-random-string-here`}</div>
                      <div style={{ fontSize:13, color:"#9ca3b8", marginTop:8, lineHeight:1.7 }}>
                        3. Railway auto-detects <code style={{ fontFamily:"'IBM Plex Mono',monospace", color:"#60a5fa" }}>npm run build && npm start</code><br/>
                        4. Your app is live at <span style={{ color:"#60a5fa", fontFamily:"'IBM Plex Mono',monospace" }}>https://YOUR-APP.railway.app</span>
                      </div>
                    </>
                  )},
                  { color:"#22c55e", step:"STEP 5 — Configure &amp; use", content:(
                    <>
                      <div style={{ fontSize:13, color:"#9ca3b8", lineHeight:1.7 }}>
                        1. Open your Railway URL → Settings → paste Google Client ID/Secret → Save<br/>
                        2. Click Connect Gmail → sign in → authorized<br/>
                        3. Settings → enter Odoo URL / DB / email / password → Test Connection<br/>
                        4. Dashboard → Scan Gmail → approve vendors → Create in Odoo 🎉
                      </div>
                    </>
                  )},
                ].map(({ color, step, content }) => (
                  <div key={step} style={{ marginBottom:24, paddingBottom:24, borderBottom:"1px solid #2e3040" }}>
                    <div style={{ fontSize:13, fontWeight:600, color, marginBottom:10, fontFamily:"'IBM Plex Mono',monospace" }}>{step}</div>
                    {content}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

      </main>
    </div>
  );
}
