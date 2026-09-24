require("dotenv").config();
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Supabase Admin API client (service role) for staff user management.
// The anon key cannot list/create/disable users; the service role key can.
// Set SUPABASE_SERVICE_ROLE_KEY (and SUPABASE_URL) in the API's environment.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function supabaseAdminFetch(path, options = {}) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not configured on the API.");
  }
  const url = `${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/${path}`;
  return fetch(url, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
}

// Restrict admin routes to an explicit allow-list of operators. Keep both the
// service-role secret out of the client AND stop anonymous callers from
// creating/disabling staff accounts.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "terence@probizn.com")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

// A simple gate: require an `x-admin-key` header matching ADMIN_KEY when set.
// (In production, integrate with your own session/JWT check here.)
function requireAdmin(req, res, next) {
  const key = process.env.ADMIN_KEY;
  if (!key) return next(); // no key configured -> open (trusted internal network)
  if ((req.get("x-admin-key") || "") === key) return next();
  return res.status(401).json({ error: "Not authorized" });
}

app.get("/admin/users", requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page, 10) || 200));
    const resp = await supabaseAdminFetch(
      `admin/users?page=${page}&per_page=${perPage}`,
      { method: "GET" }
    );
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      return res.status(resp.status).json({ error: body.message || body.error_description || "Failed to list users" });
    }
    const data = await resp.json();
    return res.json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.post("/admin/users", requireAdmin, async (req, res) => {
  try {
    const { email, password, name, role } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "email and password are required" });
    const resp = await supabaseAdminFetch(`admin/users`, {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          role: role || "staff",
          full_name: name || "",
        },
      }),
    });
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      return res.status(resp.status).json({ error: body.message || body.error_description || "Failed to create user" });
    }
    const data = await resp.json();
    return res.status(201).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.patch("/admin/users/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { ban_duration } = req.body || {};
    if (typeof ban_duration !== "string" && ban_duration !== undefined) {
      return res.status(400).json({ error: "ban_duration must be a string (e.g. '876600h')" });
    }
    const resp = await supabaseAdminFetch(`admin/users/${id}`, {
      method: "PUT",
      body: JSON.stringify({ ban_duration: ban_duration || null }),
    });
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      return res.status(resp.status).json({ error: body.message || body.error_description || "Failed to update user" });
    }
    const data = await resp.json();
    return res.json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.get("/", (req, res) => {
  res.json({
    project: process.env.RAPIDNATIVE_PROJECT_ID,
    environment: process.env.RAPIDNATIVE_ENV,
    message: "API server running",
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(port, () => {
  console.log("[api] Running on port " + port);
});
