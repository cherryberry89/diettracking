// Minimal in-memory stand-in for the Supabase HTTP API, used only by the
// end-to-end smoke test. It imitates auth, the REST tables this app uses
// (with per-user row isolation) and photo storage. It is NOT a security test.
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.FAKE_SUPABASE_PORT ?? 54399);
const users = new Map(); // email -> { id, email, password }
const tokens = new Map(); // access token -> user
const tables = { profiles: [], food_entries: [], weight_logs: [], water_logs: [], saved_foods: [] };
const OWNER = { profiles: "id" };
const files = new Map();

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function session(user) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: user.id, email: user.email, role: "authenticated", exp })}.sig${randomUUID()}`;
  tokens.set(token, user);
  const u = { id: user.id, aud: "authenticated", role: "authenticated", email: user.email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  return { access_token: token, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: randomUUID(), user: u };
}

function matches(row, params) {
  for (const [key, raw] of params) {
    if (["select", "order", "limit", "on_conflict", "columns", "offset"].includes(key)) continue;
    const [op, ...rest] = raw.split(".");
    const v = rest.join(".");
    const cell = row[key];
    if (op === "eq" && String(cell) !== v) return false;
    if (op === "gte" && !(String(cell) >= v)) return false;
    if (op === "lte" && !(String(cell) <= v)) return false;
    if (op === "in" && !v.slice(1, -1).split(",").map((s) => s.replace(/^"|"$/g, "")).includes(String(cell))) return false;
  }
  return true;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    "Access-Control-Expose-Headers": "*",
  };
  const send = (status, body) => {
    res.writeHead(status, { ...cors, "Content-Type": "application/json" });
    res.end(body === undefined ? "" : JSON.stringify(body));
  };
  if (req.method === "OPTIONS") return send(204);

  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks);
  const json = () => (raw.length ? JSON.parse(raw.toString()) : {});
  const user = tokens.get((req.headers.authorization ?? "").replace(/^Bearer /, ""));
  const path = url.pathname;

  // Auth
  if (path === "/auth/v1/signup") {
    const { email, password } = json();
    if (users.has(email)) return send(422, { code: "user_already_exists", msg: "User already registered" });
    const u = { id: randomUUID(), email, password };
    users.set(email, u);
    return send(200, session(u));
  }
  if (path === "/auth/v1/token") {
    const { email, password } = json();
    const u = users.get(email);
    if (!u || u.password !== password) return send(400, { code: "invalid_credentials", msg: "Invalid login credentials" });
    return send(200, session(u));
  }
  if (path === "/auth/v1/user") return user ? send(200, session(user).user) : send(401, { msg: "invalid token" });
  if (path === "/auth/v1/logout") return send(204);

  if (!user) return send(401, { message: "JWT required" });

  // Storage
  if (path.startsWith("/storage/v1/object/sign/")) return send(200, { signedURL: `/object/sign/x?token=fake` });
  if (path.startsWith("/storage/v1/object/list/")) {
    const prefix = json().prefix + "/";
    return send(200, [...files.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ name: k.slice(prefix.length) })));
  }
  if (path.startsWith("/storage/v1/object/meal-photos")) {
    if (req.method === "DELETE") {
      for (const p of json().prefixes ?? []) files.delete(p);
      return send(200, []);
    }
    const key = decodeURIComponent(path.replace("/storage/v1/object/meal-photos/", ""));
    if (!key.startsWith(user.id + "/")) return send(403, { message: "new row violates row-level security policy" });
    files.set(key, raw.length);
    return send(200, { Key: `meal-photos/${key}`, Id: randomUUID() });
  }

  // REST
  const m = path.match(/^\/rest\/v1\/(\w+)$/);
  const table = m && tables[m[1]];
  if (!table) return send(404, { message: `not found: ${path}` });
  const owner = OWNER[m[1]] ?? "user_id";
  const mine = (r) => r[owner] === user.id;
  const params = [...url.searchParams];
  const prefer = req.headers.prefer ?? "";
  const wantsObject = (req.headers.accept ?? "").includes("vnd.pgrst.object");
  const reply = (rows, status = 200) => {
    if (wantsObject) return rows.length === 1 ? send(status, rows[0]) : send(406, { code: "PGRST116", message: "Not a single row" });
    return send(status, rows);
  };

  if (req.method === "GET") {
    let rows = table.filter((r) => mine(r) && matches(r, params));
    const order = url.searchParams.get("order");
    if (order) {
      const [col, dir] = order.split(".");
      rows = [...rows].sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (dir === "desc" ? -1 : 1));
    }
    const limit = url.searchParams.get("limit");
    if (limit) rows = rows.slice(0, Number(limit));
    return reply(rows);
  }
  if (req.method === "POST") {
    const input = [json()].flat();
    const conflict = (url.searchParams.get("on_conflict") ?? (m[1] === "profiles" ? "id" : "")).split(",").filter(Boolean);
    const out = [];
    for (const item of input) {
      const now = new Date(Date.now() + out.length).toISOString();
      const row = { id: randomUUID(), [owner]: user.id, created_at: now, ...(m[1] === "food_entries" ? { eaten_at: now } : {}), ...item };
      if (row[owner] !== user.id) return send(403, { message: "new row violates row-level security policy" });
      const existing = conflict.length && prefer.includes("merge-duplicates")
        ? table.find((r) => mine(r) && conflict.every((c) => String(r[c]) === String(row[c])))
        : null;
      if (existing) {
        Object.assign(existing, item);
        out.push(existing);
      } else {
        table.push(row);
        out.push(row);
      }
    }
    return reply(out, 201);
  }
  if (req.method === "PATCH") {
    const rows = table.filter((r) => mine(r) && matches(r, params));
    rows.forEach((r) => Object.assign(r, json()));
    return reply(rows);
  }
  if (req.method === "DELETE") {
    const rows = table.filter((r) => mine(r) && matches(r, params));
    for (const r of rows) table.splice(table.indexOf(r), 1);
    return reply(rows);
  }
  send(405, { message: "method not allowed" });
});

server.listen(PORT, "127.0.0.1", () => console.log(`fake supabase on http://127.0.0.1:${PORT}`));
