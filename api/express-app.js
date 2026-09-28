require("dotenv").config();
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Vercel rewrites /admin/users* -> /api/vercel, so the handler receives a
// request with the rewritten path. Restore the original URL so the Express
// routes below (registered at /admin/...) match regardless of how the request
// arrived (direct /admin/users via local dev, or /api/vercel via Vercel).
app.use((req, res, next) => {
  // Vercel rewrites /admin/users* -> /api/vercel, so the handler receives a
  // request whose URL is /api/vercel. Restore the ORIGINAL public path so the
  // routes below (registered at /admin/...) match. Vercel sets x-original-path
  // (when configured) with the pre-rewrite path; otherwise reconstruct from the
  // URL. Preserve the query string.
  const originalPath = req.get("x-original-path");
  if (originalPath && originalPath.startsWith("/admin/")) {
    const qs = req.url.split("?")[1];
    req.url = originalPath + (qs ? `?${qs}` : "");
    req.originalUrl = req.url;
  } else {
    const [path, query] = req.url.split("?");
    if (path.startsWith("/api/vercel")) {
      const restored = path.replace(/^\/api\/vercel/, "") || "/";
      req.url = restored + (query ? `?${query}` : "");
      req.originalUrl = req.url;
    }
  }
  next();
});

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

// Admin authorization: validate the caller is an allowed admin so a staff
// user can never create/disable accounts. Two independent checks, either passes:
//   1) A valid Supabase session JWT (`x-supabase-token`) whose email is in
//      ADMIN_EMAILS — the proper per-user check.
//   2) The shared `x-admin-key` header matching ADMIN_KEY — a fallback for
//      server tooling/scripts (also requires ADMIN_KEY to be configured).
// Fail closed: unset config or no valid credentials => 401/503.
const ADMIN_EMAILS = (
  process.env.ADMIN_EMAILS ||
  process.env.EXPO_PUBLIC_ADMIN_EMAILS ||
  ""
)
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

async function requireAdmin(req, res, next) {
  const adminKey = process.env.ADMIN_KEY;
  const headerKey = req.get("x-admin-key") || "";

  // Check 1: shared key (must be configured to use this path — fail closed)
  if (!adminKey) {
    return res.status(503).json({ error: "ADMIN_KEY is not configured on the API." });
  }
  if (headerKey === adminKey) return next();

  // Check 2: caller's Supabase session JWT belongs to an allowed admin email.
  // `/auth/v1/user` expects the anon key as `apikey` and the user's JWT as
  // `Authorization` (the service-role key would override the user identity).
  const token = req.get("x-supabase-token") || "";
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (token && ADMIN_EMAILS.length > 0 && SUPABASE_URL && anonKey) {
    try {
      const url = `${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user`;
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
      });
      if (resp.ok) {
        const data = await resp.json();
        const email = (data?.email || "").toLowerCase();
        if (ADMIN_EMAILS.includes(email)) return next();
      }
    } catch (_) {
      // fall through to reject
    }
  }

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

// Update a user's email (and optionally full name). Keeps existing metadata.
app.post("/admin/users/:id/email", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, name } = req.body || {};
    if (!id || !email) return res.status(400).json({ error: "email is required" });
    const body = { email: String(email).trim() };
    // Merge full_name only if explicitly provided, so toggling email doesn't wipe it.
    if (typeof name === "string" && name.trim()) {
      body.user_metadata = { full_name: name.trim() };
    }
    const resp = await supabaseAdminFetch(`admin/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const b = await resp.json().catch(() => ({}));
      return res.status(resp.status).json({ error: b.msg || b.message || b.error_description || "Failed to update email" });
    }
    return res.json(await resp.json());
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// Reset a user's password. Supabase auto-confirms the new password so the
// staff member can sign in immediately with it (email confirmation is OFF).
app.post("/admin/users/:id/reset-password", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body || {};
    if (!id || !password) return res.status(400).json({ error: "password is required" });
    if (String(password).length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }
    const resp = await supabaseAdminFetch(`admin/users/${id}`, {
      method: "PUT",
      body: JSON.stringify({ password: String(password) }),
    });
    if (!resp.ok) {
      const b = await resp.json().catch(() => ({}));
      return res.status(resp.status).json({ error: b.msg || b.message || b.error_description || "Failed to reset password" });
    }
    return res.json(await resp.json());
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.get("/api", (req, res) => {
  res.json({
    project: process.env.RAPIDNATIVE_PROJECT_ID,
    environment: process.env.RAPIDNATIVE_ENV,
    message: "API server running",
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Start a standalone server when run directly (local dev); on Vercel,
// vercel.js imports this app and exports it as the serverless handler.
if (require.main === module) {
  app.listen(port, () => {
    console.log(`API listening on port ${port}`);
  });
}

module.exports = app;
