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

// PostgREST helper using the service role key — lets the API read/write public
// tables (e.g. clients) with full access, bypassing RLS. The SQL Editor here
// cannot see `auth.users`, but the Auth Admin API can, and PostgREST can write.
function supabasePg(path, options = {}) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not configured on the API.");
  }
  const url = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path}`;
  return fetch(url, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      ...(options.headers || {}),
    },
  });
}

// Resolve the caller's identity from `x-supabase-token`: returns the decoded
// user object ({ email, role, ... }) or null if the token is absent/invalid.
async function resolveCaller(req) {
  const token = req.get("x-supabase-token") || "";
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!token || !anonKey || !url) return null;
  try {
    const resp = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return {
      id: data?.id || "",
      email: (data?.email || "").toLowerCase(),
      role: (data?.user_metadata?.role || "staff").toLowerCase(),
    };
  } catch (_) {
    return null;
  }
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

// Supervisor (or admin) can read the staff roster (for import/reassign).
async function requireManager(req, res, next) {
  const adminKey = process.env.ADMIN_KEY;
  const headerKey = req.get("x-admin-key") || "";
  if (adminKey && headerKey === adminKey) return next();

  const caller = await resolveCaller(req);
  if (caller && (caller.role === "admin" || caller.role === "supervisor" || ADMIN_EMAILS.includes(caller.email))) {
    req.caller = caller;
    return next();
  }
  return res.status(401).json({ error: "Not authorized" });
}

async function requireAdmin(req, res, next) {
  const adminKey = process.env.ADMIN_KEY;
  const headerKey = req.get("x-admin-key") || "";

  // Check 1: shared key (must be configured to use this path — fail closed)
  if (!adminKey) {
    return res.status(503).json({ error: "ADMIN_KEY is not configured on the API." });
  }
  if (headerKey === adminKey) return next();

  // Check 2: caller's Supabase session JWT belongs to an allowed admin email OR
  // has role "admin". `/auth/v1/user` expects the anon key as `apikey` and the
  // user's JWT as `Authorization` (the service-role key would override identity).
  const caller = await resolveCaller(req);
  if (caller && ADMIN_EMAILS.length > 0) {
    if (caller.role === "admin" || ADMIN_EMAILS.includes(caller.email)) {
      req.caller = caller;
      return next();
    }
  }

  return res.status(401).json({ error: "Not authorized" });
}

app.get("/admin/users", requireManager, async (req, res) => {
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

// Change a user's role (staff | supervisor | admin). Admin-only.
app.post("/admin/users/:id/role", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body || {};
    const allowed = ["staff", "supervisor", "admin"];
    if (!id || !role || !allowed.includes(String(role))) {
      return res.status(400).json({ error: `role must be one of: ${allowed.join(", ")}` });
    }
    const resp = await supabaseAdminFetch(`admin/users/${id}`, {
      method: "PUT",
      body: JSON.stringify({ user_metadata: { role: String(role) } }),
    });
    if (!resp.ok) {
      const b = await resp.json().catch(() => ({}));
      return res.status(resp.status).json({ error: b.msg || b.message || b.error_description || "Failed to update role" });
    }
    return res.json(await resp.json());
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// Backfill `clients.staff_user_id` from the staff's auth account, matched by
// email. Runs server-side with the service role (so it CAN read auth.users,
// unlike the public SQL Editor) and needs NO UUID pasting by the admin.
// Mapping is fixed to the placeholder staff accounts:
//   staff1@probizn.com -> Hazel, staff2@probizn.com -> Iris,
//   staff3@probizn.com -> Sarah Mitchell.
app.post("/admin/clients/backfill-staff", requireAdmin, async (req, res) => {
  try {
    // 1. List auth users (service role) to resolve email -> user id.
    let allUsers = [];
    let page = 1;
    for (let i = 0; i < 10; i += 1) {
      const resp = await supabaseAdminFetch(`admin/users?page=${page}&per_page=200`, { method: "GET" });
      if (!resp.ok) {
        const b = await resp.json().catch(() => ({}));
        return res.status(resp.status).json({ error: b.message || b.error_description || "Failed to list users" });
      }
      const data = await resp.json();
      const users = data.users || [];
      allUsers = allUsers.concat(users);
      if (users.length < 200) break;
      page += 1;
    }

    const byEmail = {};
    for (const u of allUsers) {
      if (u.email) byEmail[String(u.email).toLowerCase()] = u.id;
    }

    const mapping = [
      { email: "staff1@probizn.com", name: "Hazel" },
      { email: "staff2@probizn.com", name: "Iris" },
      { email: "staff3@probizn.com", name: "Sarah Mitchell" },
    ];

    const results = [];
    for (const m of mapping) {
      const uid = byEmail[m.email.toLowerCase()];
      if (!uid) {
        results.push({ name: m.name, email: m.email, updated: 0, error: "no matching auth user" });
        continue;
      }
      // 2. Write the staff_user_id onto every client whose handling_staff is
      //    this name (and which doesn't already have the correct link).
      const patch = await supabasePg(
        `clients?handling_staff=eq.${encodeURIComponent(m.name)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify({ staff_user_id: uid }),
        }
      );
      if (!patch.ok) {
        const b = await patch.json().catch(() => ({}));
        results.push({ name: m.name, email: m.email, updated: 0, error: b.message || b.details || "patch failed" });
        continue;
      }
      const patched = await patch.json().catch(() => []);
      results.push({ name: m.name, email: m.email, updated: Array.isArray(patched) ? patched.length : 0 });
    }

    return res.json({ ok: true, results });
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
