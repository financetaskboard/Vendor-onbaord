const express    = require("express");
const { google } = require("googleapis");
const axios      = require("axios");
const path       = require("path");

const app  = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());
app.use(express.static(path.join(__dirname, "dist")));

// ─────────────────────────────────────────────
//  FIREBASE ADMIN — same pattern as TDS app
// ─────────────────────────────────────────────
let db = null;

function initFirebase() {
  try {
    const admin = require("firebase-admin");
    if (!admin.apps.length) {
      const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId:   process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
      });
    }
    db = admin.firestore();
    console.log("✅ Firebase connected");
  } catch (e) {
    console.warn("⚠ Firebase not configured — state will not persist:", e.message);
  }
}
initFirebase();

// ── State helpers (mirrors TDS app /api/state pattern)
const COLLECTION = "vendor-approval";

async function storeGet(key) {
  if (!db) return null;
  const doc = await db.collection(COLLECTION).doc(encodeURIComponent(key)).get();
  return doc.exists ? doc.data().value : null;
}

async function storeSet(key, value) {
  if (!db) return;
  await db.collection(COLLECTION).doc(encodeURIComponent(key)).set({ value });
}

async function storeDelete(key) {
  if (!db) return;
  await db.collection(COLLECTION).doc(encodeURIComponent(key)).delete();
}

// ── State API endpoints (same as TDS app)
app.get("/api/state/:key", async (req, res) => {
  try {
    const value = await storeGet(req.params.key);
    if (value !== null) res.json({ ok: true, value });
    else res.json({ ok: false });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/api/state/:key", async (req, res) => {
  try {
    await storeSet(req.params.key, req.body.value);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.delete("/api/state", async (req, res) => {
  try {
    if (db) {
      const snap = await db.collection(COLLECTION).get();
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});


// ─────────────────────────────────────────────
//  CONFIG — stored in Firebase under "config"
// ─────────────────────────────────────────────
app.get("/api/config", async (req, res) => {
  try {
    const cfg = await storeGet("config") || {};
    // Mask sensitive fields
    const safe = { ...cfg };
    if (safe.googleClientSecret) safe.googleClientSecret = "••••••••";
    if (safe.odooPassword)       safe.odooPassword       = "••••••••";
    res.json(safe);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/config", async (req, res) => {
  try {
    const existing = await storeGet("config") || {};
    const updated  = { ...existing, ...req.body };
    await storeSet("config", updated);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// ─────────────────────────────────────────────
//  GMAIL OAUTH2
// ─────────────────────────────────────────────
function getAppUrl(req) {
  return process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
}

async function getOAuth2Client(req) {
  const cfg = await storeGet("config") || {};
  if (!cfg.googleClientId || !cfg.googleClientSecret) return null;
  const client = new google.auth.OAuth2(
    cfg.googleClientId,
    cfg.googleClientSecret,
    `${getAppUrl(req)}/auth/callback`
  );
  const tokens = await storeGet("gmail-tokens");
  if (tokens) client.setCredentials(tokens);
  return client;
}

app.get("/auth/start", async (req, res) => {
  const client = await getOAuth2Client(req);
  if (!client) return res.redirect("/?error=Google+credentials+not+configured+in+Settings");
  const url = client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/gmail.readonly"],
    prompt: "consent",
  });
  res.redirect(url);
});

app.get("/auth/callback", async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.redirect("/?error=" + encodeURIComponent(error));
  const client = await getOAuth2Client(req);
  if (!client || !code) return res.redirect("/?error=auth_failed");
  try {
    const { tokens } = await client.getToken(code);
    await storeSet("gmail-tokens", tokens);
    res.redirect("/?connected=true");
  } catch (e) {
    res.redirect("/?error=" + encodeURIComponent(e.message));
  }
});

app.get("/api/gmail/status", async (req, res) => {
  const tokens = await storeGet("gmail-tokens");
  res.json({ connected: !!(tokens && tokens.access_token) });
});

app.post("/api/gmail/disconnect", async (req, res) => {
  await storeDelete("gmail-tokens");
  res.json({ ok: true });
});


// ─────────────────────────────────────────────
//  GMAIL SCAN
//  FIX 1: Search for BOTH "for your review" AND "Complete" emails
//  FIX 2: fullyApproved = presence of a "Complete" subject email
//  NEW:   Extract attachment metadata for later upload to Odoo
// ─────────────────────────────────────────────
app.get("/api/gmail/scan", async (req, res) => {
  try {
    const cfg    = await storeGet("config") || {};
    const client = await getOAuth2Client(req);
    const tokens = await storeGet("gmail-tokens");

    if (!client || !tokens) {
      return res.status(401).json({ error: "Gmail not connected.", authExpired: true });
    }

    // Refresh token if expired
    client.setCredentials(tokens);
    client.on("tokens", async (newTokens) => {
      const merged = { ...tokens, ...newTokens };
      await storeSet("gmail-tokens", merged);
    });

    const gmail  = google.gmail({ version: "v1", auth: client });
    const since  = Math.floor((Date.now() - 60 * 24 * 60 * 60 * 1000) / 1000);

    // FIX 1: Also search for "Complete" emails so fully-approved vendors are found
    const reviewSubject = cfg.emailSubject || "for your review";
    const query = `(subject:"${reviewSubject}" OR subject:"Complete") after:${since}`;

    console.log("Gmail search:", query);

    const listRes  = await gmail.users.messages.list({ userId: "me", q: query, maxResults: 100 });
    const messages = listRes.data.messages || [];
    console.log("Messages found:", messages.length);

    const requestMap = {};

    for (const msg of messages) {
      const full    = await gmail.users.messages.get({ userId: "me", id: msg.id, format: "full" });
      const headers = full.data.payload.headers || [];
      const subj    = (headers.find(h => h.name === "Subject") || {}).value || "";
      const date    = (headers.find(h => h.name === "Date")    || {}).value || "";
      const match   = subj.match(/Request\s*#?\s*(\d+)/i);
      if (!match) continue;

      const reqNum     = match[1];
      const body       = extractBody(full.data.payload);
      // NEW: collect attachment metadata from this email
      const attachments = extractAttachments(full.data.payload, msg.id);

      if (!requestMap[reqNum]) requestMap[reqNum] = [];
      requestMap[reqNum].push({ subj, body, date, attachments });
    }

    const vendors = [];
    for (const [reqNum, emails] of Object.entries(requestMap)) {
      const sorted = emails.sort((a, b) => new Date(a.date) - new Date(b.date));
      const vendor = parseVendor(sorted[0].body, reqNum);
      vendor.emailCount = emails.length;

      // FIX 2: Approved only when a "Complete" email is actually present
      vendor.fullyApproved = emails.some(e => /complete/i.test(e.subj));

      vendor.latestDate = sorted[sorted.length - 1].date;

      // NEW: Merge all attachments from every email for this request (dedupe by filename)
      const allAttachments = emails.flatMap(e => e.attachments || []);
      const seen = new Set();
      vendor.attachments = allAttachments.filter(a => {
        if (seen.has(a.filename)) return false;
        seen.add(a.filename);
        return true;
      });

      vendors.push(vendor);
    }

    vendors.sort((a, b) => b.fullyApproved - a.fullyApproved);
    res.json({ vendors, total: vendors.length });

  } catch (e) {
    console.error("Gmail scan error:", e.message);
    const authExpired = e.code === 401 || e.message?.includes("invalid_grant");
    if (authExpired) await storeDelete("gmail-tokens");
    res.status(authExpired ? 401 : 500).json({ error: e.message, authExpired });
  }
});


// ─────────────────────────────────────────────
//  EMAIL HELPERS
// ─────────────────────────────────────────────
function extractBody(payload) {
  if (!payload) return "";
  function decode(part) {
    return Buffer.from(part.body.data, "base64").toString("utf8");
  }
  function htmlToText(html) {
    return html
      .replace(/<\/td>/gi, ": ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/tr>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/[ \t]+/g, " ")
      .replace(/: :/g, ":")
      .trim();
  }
  function collectParts(p, plains, htmls) {
    if (!p) return;
    if (p.mimeType === "text/plain" && p.body?.data) plains.push(decode(p));
    else if (p.mimeType === "text/html" && p.body?.data) htmls.push(htmlToText(decode(p)));
    else if (p.parts) p.parts.forEach(c => collectParts(c, plains, htmls));
  }
  const plains = [], htmls = [];
  collectParts(payload, plains, htmls);
  if (plains.length) { const t = plains.join("\n"); if (t.includes(":")) return t; }
  if (htmls.length) return htmls.join("\n");
  return "";
}

// NEW: Walk Gmail payload and collect all file attachments (ignore inline images)
function extractAttachments(payload, messageId) {
  const results = [];
  function walk(part) {
    if (!part) return;
    const filename = part.filename;
    const attachId = part.body?.attachmentId;
    if (filename && attachId) {
      results.push({
        messageId,
        attachmentId: attachId,
        filename,
        mimeType: part.mimeType || "application/octet-stream",
      });
    }
    if (part.parts) part.parts.forEach(walk);
  }
  walk(payload);
  return results;
}

function parseVendor(body, reqNum) {
  function field(...patterns) {
    for (const p of patterns) {
      const re = new RegExp(p + "\\s*[:\\t]+\\s*(.+)", "im");
      const m  = body.match(re);
      if (m && m[1].trim() && !m[1].includes("File Upload"))
        return m[1].trim().replace(/\r/g, "");
    }
    return "";
  }
  return {
    requestNumber:      reqNum,
    vendorCode:         field("Vendor Code"),
    companyName:        field("Company/Firm/Proprietorship Name", "Company/Firm Name", "Company Name"),
    officialEmail:      field("Offical Email ID", "Official Email ID", "Official Email"),
    address:            field("Unit No/House Name/Sector", "Street Address", "Address"),
    city:               field("City"),
    state:              field("State"),
    pinCode:            field("Pin Code", "PIN Code", "Pincode"),
    country:            field("Country") || "India",
    contactName:        field("^Name"),
    designation:        field("Designation"),
    contactPhone:       field("Contact No\\.?", "Phone No"),
    contactEmail:       field("^Email ID"),
    gstin:              field("GST Number", "GSTIN"),
    gstBillingAddress:  field("GST Billing Address"),
    pan:                field("^PAN"),
    gstFilingFrequency: field("Frequency of filing Return", "Filing Frequency"),
    gstTaxpayerType:    field("Taxpayer Type"),
    msmeRegistered:     field("Registered under MSME").toLowerCase() === "yes",
    msmeNo:             field("MSME No\\.?"),
    msmeStatus:         field("MSME Status"),
    bankName:           field("Bank Name"),
    accountHolderName:  field("Account Holder Name"),
    accountNumber:      field("Account Number"),
    accountType:        field("Type of Account"),
    ifscCode:           field("IFSC Code", "IFSC"),
    branch:             field("^Branch"),
  };
}


// ─────────────────────────────────────────────
//  ODOO TEST
// ─────────────────────────────────────────────
app.post("/api/odoo/test", async (req, res) => {
  const cfg = await storeGet("config") || {};
  if (!cfg.odooUrl || !cfg.odooDb || !cfg.odooUsername || !cfg.odooPassword)
    return res.status(400).json({ error: "Odoo credentials not configured in Settings." });
  const url = cfg.odooUrl.replace(/\/$/, "");
  try {
    const r = await axios.post(`${url}/web/session/authenticate`, {
      jsonrpc:"2.0", method:"call", id:1,
      params: { db: cfg.odooDb, login: cfg.odooUsername, password: cfg.odooPassword },
    });
    if (!r.data.result?.uid) throw new Error("Login failed — check credentials.");
    res.json({ ok: true, uid: r.data.result.uid });
  } catch (e) {
    res.status(400).json({ error: e.response?.data?.error?.data?.message || e.message });
  }
});


// ─────────────────────────────────────────────
//  ODOO CREATE VENDOR
// ─────────────────────────────────────────────
app.post("/api/odoo/create-vendor", async (req, res) => {
  const cfg    = await storeGet("config") || {};
  const vendor = req.body;

  if (!cfg.odooUrl || !cfg.odooDb || !cfg.odooUsername || !cfg.odooPassword)
    return res.status(400).json({ error: "Odoo credentials not configured." });

  const url  = cfg.odooUrl.replace(/\/$/, "");
  const base = { jsonrpc:"2.0", method:"call" };

  try {
    // Auth
    const authRes = await axios.post(`${url}/web/session/authenticate`, {
      ...base, id:1,
      params: { db: cfg.odooDb, login: cfg.odooUsername, password: cfg.odooPassword },
    });
    if (!authRes.data.result?.uid) throw new Error("Odoo login failed.");
    const cookie = authRes.headers["set-cookie"]?.join("; ") || "";

    // GST treatment map
    const gstMap  = { regular:"regular", composition:"composition", unregistered:"consumer" };
    const gstType = gstMap[(vendor.gstTaxpayerType || "").toLowerCase()] || "regular";

    const notes = [
      `=== Vendor Onboarding — Request #${vendor.requestNumber} ===`,
      `Vendor Code   : ${vendor.vendorCode || "N/A"}`,
      `PAN           : ${vendor.pan || "N/A"}`,
      `GST Filing    : ${vendor.gstFilingFrequency || "N/A"}`,
      `GST Billing   : ${vendor.gstBillingAddress || "N/A"}`,
      ``,
      `--- MSME ---`,
      `MSME Registered : ${vendor.msmeRegistered ? "Yes" : "No"}`,
      `MSME No.        : ${vendor.msmeNo || "N/A"}`,
      `MSME Status     : ${vendor.msmeStatus || "N/A"}`,
      ``,
      `--- Bank ---`,
      `Bank            : ${vendor.bankName || "N/A"}`,
      `Holder          : ${vendor.accountHolderName || "N/A"}`,
      `Account No.     : ${vendor.accountNumber || "N/A"}`,
      `Account Type    : ${vendor.accountType || "N/A"}`,
      `IFSC            : ${vendor.ifscCode || "N/A"}`,
      `Branch          : ${vendor.branch || "N/A"}`,
      ``,
      `--- Contact ---`,
      `Name            : ${vendor.contactName || "N/A"}`,
      `Designation     : ${vendor.designation || "N/A"}`,
      `Phone           : ${vendor.contactPhone || "N/A"}`,
      `Email           : ${vendor.contactEmail || "N/A"}`,
    ].join("\n");

    const createRes = await axios.post(`${url}/web/dataset/call_kw`, {
      ...base, id:2,
      params: {
        model:"res.partner", method:"create",
        args: [{
          name:                  vendor.companyName,
          company_type:          "company",
          is_company:            true,
          supplier_rank:         1,
          customer_rank:         0,
          email:                 vendor.officialEmail     || false,
          phone:                 (vendor.contactPhone && vendor.contactPhone !== "NA") ? vendor.contactPhone : false,
          street:                vendor.address           || false,
          city:                  vendor.city              || false,
          zip:                   vendor.pinCode           || false,
          country_id:            105,
          vat:                   vendor.gstin             || false,
          l10n_in_gst_treatment: gstType,
          comment:               notes,
        }],
        kwargs: {},
      },
    }, { headers: { Cookie: cookie, "Content-Type":"application/json" } });

    if (!createRes.data.result) {
      const msg = createRes.data.error?.data?.message || "Odoo returned an error";
      throw new Error(msg);
    }

    const odooId = createRes.data.result;
    console.log(`✅ Vendor created: ${vendor.companyName} → Odoo ID ${odooId}`);
    res.json({
      ok: true,
      odooId,
      odooLink: `${url}/web#id=${odooId}&model=res.partner&view_type=form&cids=1&menu_id=199`,
    });

  } catch (e) {
    console.error("Odoo error:", e.message);
    res.status(500).json({ error: e.response?.data?.error?.data?.message || e.message });
  }
});


// ─────────────────────────────────────────────
//  NEW: UPLOAD GMAIL ATTACHMENTS → ODOO VENDOR
//  POST /api/odoo/upload-attachments
//  Body: { odooId, attachments: [{messageId, attachmentId, filename, mimeType}] }
// ─────────────────────────────────────────────
app.post("/api/odoo/upload-attachments", async (req, res) => {
  const cfg         = await storeGet("config") || {};
  const { odooId, attachments } = req.body;

  if (!odooId || !attachments?.length)
    return res.status(400).json({ error: "odooId and attachments are required." });

  if (!cfg.odooUrl || !cfg.odooDb || !cfg.odooUsername || !cfg.odooPassword)
    return res.status(400).json({ error: "Odoo credentials not configured." });

  try {
    // ── 1. Get Gmail client
    const client = await getOAuth2Client(req);
    const tokens = await storeGet("gmail-tokens");
    if (!client || !tokens) return res.status(401).json({ error: "Gmail not connected.", authExpired: true });
    client.setCredentials(tokens);
    const gmail = google.gmail({ version: "v1", auth: client });

    // ── 2. Authenticate with Odoo
    const url  = cfg.odooUrl.replace(/\/$/, "");
    const base = { jsonrpc:"2.0", method:"call" };
    const authRes = await axios.post(`${url}/web/session/authenticate`, {
      ...base, id:1,
      params: { db: cfg.odooDb, login: cfg.odooUsername, password: cfg.odooPassword },
    });
    if (!authRes.data.result?.uid) throw new Error("Odoo login failed.");
    const cookie = authRes.headers["set-cookie"]?.join("; ") || "";

    // ── 3. Download each attachment from Gmail and upload to Odoo
    const results = [];
    for (const att of attachments) {
      try {
        console.log(`📎 Downloading: ${att.filename} from message ${att.messageId}`);

        // Download from Gmail
        const gmailAtt = await gmail.users.messages.attachments.get({
          userId: "me",
          messageId: att.messageId,
          id: att.attachmentId,
        });

        // Gmail returns URL-safe base64; Odoo needs standard base64
        const base64Data = (gmailAtt.data.data || "")
          .replace(/-/g, "+")
          .replace(/_/g, "/");

        // Upload to Odoo as ir.attachment linked to the vendor (res.partner)
        const uploadRes = await axios.post(`${url}/web/dataset/call_kw`, {
          ...base, id: Date.now(),
          params: {
            model:  "ir.attachment",
            method: "create",
            args: [{
              name:      att.filename,
              type:      "binary",
              datas:     base64Data,
              res_model: "res.partner",
              res_id:    odooId,
              mimetype:  att.mimeType,
            }],
            kwargs: {},
          },
        }, { headers: { Cookie: cookie, "Content-Type": "application/json" } });

        if (uploadRes.data.result) {
          console.log(`✅ Uploaded: ${att.filename} → Odoo attachment ID ${uploadRes.data.result}`);
          results.push({ filename: att.filename, ok: true, attachmentId: uploadRes.data.result });
        } else {
          const errMsg = uploadRes.data.error?.data?.message || "Upload failed";
          console.warn(`⚠ Failed: ${att.filename} — ${errMsg}`);
          results.push({ filename: att.filename, ok: false, error: errMsg });
        }
      } catch (attErr) {
        console.warn(`⚠ Error uploading ${att.filename}:`, attErr.message);
        results.push({ filename: att.filename, ok: false, error: attErr.message });
      }
    }

    const uploaded = results.filter(r => r.ok).length;
    res.json({ ok: true, uploaded, total: results.length, results });

  } catch (e) {
    console.error("Attachment upload error:", e.message);
    const authExpired = e.code === 401 || e.message?.includes("invalid_grant");
    if (authExpired) await storeDelete("gmail-tokens");
    res.status(authExpired ? 401 : 500).json({ error: e.message, authExpired });
  }
});


// ─────────────────────────────────────────────
//  SPA fallback — serve React app for all routes
// ─────────────────────────────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => {
  console.log(`\n✅ Vendor Approval → Odoo running on port ${PORT}\n`);
});
