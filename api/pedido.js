// Registra pedidos en una Google Sheet.
//   POST /api/pedido  { action: "create", folio, name, phone, time, notes, total, items[] }
//   POST /api/pedido  { action: "confirm", folio }
//
// Variables de entorno (Vercel → Settings → Environment Variables):
//   GOOGLE_SERVICE_ACCOUNT_EMAIL  correo de la cuenta de servicio
//   GOOGLE_PRIVATE_KEY            llave privada (con los \n tal cual vienen en el JSON)
//   GOOGLE_SHEET_ID               ID de la hoja (lo que va entre /d/ y /edit en la URL)
//   GOOGLE_SHEET_TAB              nombre de la pestaña (opcional, por defecto "Pedidos")
//
// No se guarda la IP: solo se usa en memoria para limitar abusos.

const crypto = require("crypto");

const HEADERS = ["Folio", "Fecha", "Nombre", "Teléfono", "Pedido", "Total", "Hora recoger", "Notas", "Dispositivo", "Estado", "Confirmado"];
const ALLOWED_HOSTS = [/^fer-sangloton(-[a-z0-9-]+)?\.vercel\.app$/, /^localhost(:\d+)?$/, /^127\.0\.0\.1(:\d+)?$/];

// ---------- Límite simple por IP (en memoria, no se persiste) ----------
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now(), win = 10 * 60 * 1000, max = 15;
  const arr = (hits.get(ip) || []).filter((t) => now - t < win);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > max;
}

// ---------- Google auth (JWT de cuenta de servicio) ----------
let cachedToken = null;
async function getToken() {
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.value;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = b64({ alg: "RS256", typ: "JWT" }) + "." + b64({
    iss: email, scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  });
  const sig = crypto.createSign("RSA-SHA256").update(unsigned).sign(key).toString("base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: unsigned + "." + sig }),
  });
  if (!r.ok) throw new Error("token " + r.status + " " + (await r.text()));
  const j = await r.json();
  cachedToken = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return cachedToken.value;
}

async function sheets(path, opts = {}) {
  const token = await getToken();
  const id = process.env.GOOGLE_SHEET_ID;
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/${path}`, {
    ...opts,
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
  });
  if (!r.ok) throw new Error("sheets " + r.status + " " + (await r.text()));
  return r.json();
}

// ---------- Utilidades ----------
const tab = () => process.env.GOOGLE_SHEET_TAB || "Pedidos";
const range = (a1) => encodeURIComponent(`'${tab()}'!${a1}`);
const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
const now = () => new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City", hour12: false });
function device(ua = "") {
  if (/iPhone|iPad/i.test(ua)) return "iPhone/iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Macintosh/i.test(ua)) return "Mac";
  return "Otro";
}

async function ensureHeaders() {
  const r = await sheets(`values/${range("A1:K1")}`);
  if (!r.values || !r.values.length) {
    await sheets(`values/${range("A1:K1")}?valueInputOption=RAW`, { method: "PUT", body: JSON.stringify({ values: [HEADERS] }) });
  }
}

// ---------- Handler ----------
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ ok: false });

  const origin = req.headers.origin || "";
  let host = "";
  try { host = new URL(origin).host; } catch {}
  if (!ALLOWED_HOSTS.some((re) => re.test(host))) return res.status(403).json({ ok: false });

  if (!process.env.GOOGLE_SHEET_ID || !process.env.GOOGLE_PRIVATE_KEY || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
    return res.status(503).json({ ok: false, error: "not_configured" });
  }

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "?";
  if (rateLimited(ip)) return res.status(429).json({ ok: false });

  const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const folio = clean(b.folio, 12);
  if (!/^SG-[A-Z0-9]{5}$/.test(folio)) return res.status(400).json({ ok: false });

  try {
    if (b.action === "create") {
      if (b.website) return res.status(200).json({ ok: true }); // bot (campo trampa lleno)
      const phone = clean(b.phone, 15).replace(/\D/g, "");
      const items = Array.isArray(b.items) ? b.items.slice(0, 40).map((i) => clean(i, 160)) : [];
      if (!clean(b.name, 1) || phone.length !== 10 || !items.length) return res.status(400).json({ ok: false });
      await ensureHeaders();
      const row = [folio, now(), clean(b.name, 80), phone, items.join("\n"), Number(b.total) || 0,
        clean(b.time, 5), clean(b.notes, 500), device(req.headers["user-agent"]), "Intento", ""];
      // RAW: el texto se guarda tal cual (evita que "=..." se interprete como fórmula)
      await sheets(`values/${range("A:K")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
        method: "POST", body: JSON.stringify({ values: [row] }),
      });
      return res.status(200).json({ ok: true });
    }

    if (b.action === "confirm") {
      const col = await sheets(`values/${range("A:A")}`);
      const rows = col.values || [];
      for (let i = rows.length - 1; i >= 1; i--) {
        if (rows[i][0] === folio) {
          const n = i + 1;
          await sheets(`values/${range(`J${n}:K${n}`)}?valueInputOption=RAW`, {
            method: "PUT", body: JSON.stringify({ values: [["Confirmado", now()]] }),
          });
          return res.status(200).json({ ok: true });
        }
      }
      return res.status(404).json({ ok: false });
    }

    return res.status(400).json({ ok: false });
  } catch (e) {
    console.error("[pedido]", e.message);
    return res.status(500).json({ ok: false });
  }
};
