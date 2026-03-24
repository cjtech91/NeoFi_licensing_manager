function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function requireAuth(request, env) {
  const expected = env.CF_API_TOKEN || env.API_TOKEN;
  if (!expected) return true;
  const auth = request.headers.get('Authorization') || '';
  const parts = auth.split(' ');
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    return parts[1] === expected;
  }
  return false;
}

function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function toBase64(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

async function importPrivateKey(pem) {
  const keyData = pemToArrayBuffer(pem);
  return crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

async function signToken(token, env) {
  const pem = env.LICENSE_PRIVATE_KEY_PEM;
  if (!pem) throw new Error('Missing LICENSE_PRIVATE_KEY_PEM');
  const key = await importPrivateKey(pem);
  const data = new TextEncoder().encode(JSON.stringify(token));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, data);
  return toBase64(sig);
}

function nowTs() {
  return Date.now();
}

async function getLicenseRow(env, key) {
  const r = await env.DB.prepare(
    'SELECT license_key, status, owner, type, expires_at, bound_serial, activated_at FROM licenses WHERE license_key = ? LIMIT 1'
  )
    .bind(key)
    .first();
  return r || null;
}

function normalizeStatus(s) {
  const v = String(s || '').toLowerCase();
  if (v === 'revoked') return 'revoked';
  if (v === 'used') return 'used';
  return 'active';
}

async function ensureSchema(env) {
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS licenses (license_key TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'active', owner TEXT, type TEXT NOT NULL DEFAULT 'lifetime', expires_at INTEGER, bound_serial TEXT, activated_at INTEGER, created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000), updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000))"
  ).run();
  await env.DB.prepare(
    'CREATE TABLE IF NOT EXISTS machines (system_serial TEXT PRIMARY KEY, device_model TEXT, last_seen_at INTEGER, metadata_json TEXT)'
  ).run();
}

async function bindAndMarkUsed(env, key, systemSerial) {
  const ts = nowTs();
  await env.DB.prepare(
    "UPDATE licenses SET status='used', bound_serial=COALESCE(NULLIF(bound_serial,''), ?), activated_at=COALESCE(activated_at, ?), updated_at=? WHERE license_key=?"
  )
    .bind(systemSerial, ts, ts, key)
    .run();
}

function isExpired(row) {
  const exp = Number(row.expires_at || 0);
  return exp > 0 && exp < nowTs();
}

function buildToken(row, systemSerial, deviceModel) {
  return {
    type: row.type || 'PAID',
    owner: row.owner || 'Customer',
    expires: row.expires_at ? new Date(Number(row.expires_at)).toISOString() : 'Never',
    system_serial: systemSerial,
    System_Serial: systemSerial,
    device_model: deviceModel || null,
  };
}

async function handleActivate(request, env) {
  if (!requireAuth(request, env)) return jsonResponse({ allowed: false, status: 'unauthorized' }, 401);
  if (!env.DB) return jsonResponse({ allowed: false, status: 'db_not_bound' }, 500);
  await ensureSchema(env);
  const body = await request.json().catch(() => ({}));
  const key = String(body.key || body.license_key || '').trim();
  const systemSerial = String(body.system_serial || body.System_Serial || body.hwid || body.serial || '').trim();
  const deviceModel = String(body.device_model || '').trim();
  if (!key || !systemSerial) return jsonResponse({ allowed: false, status: 'bad_request' }, 400);

  const row = await getLicenseRow(env, key);
  if (!row) return jsonResponse({ allowed: false, status: 'not_found' }, 404);
  const status = normalizeStatus(row.status);
  if (status === 'revoked') return jsonResponse({ allowed: false, status: 'revoked' }, 200);
  if (isExpired(row)) return jsonResponse({ allowed: false, status: 'expired' }, 200);

  const bound = String(row.bound_serial || '').trim();
  if (bound && bound !== systemSerial) {
    return jsonResponse({ allowed: false, status: 'bind_failed', message: 'Key is bound to another device' }, 200);
  }
  if (status === 'active') await bindAndMarkUsed(env, key, systemSerial);

  const token = buildToken(row, systemSerial, deviceModel);
  const signature = await signToken(token, env);
  return jsonResponse({ allowed: true, token, signature }, 200);
}

async function handleValidate(request, env) {
  if (!requireAuth(request, env)) return jsonResponse({ allowed: false, status: 'unauthorized' }, 401);
  if (!env.DB) return jsonResponse({ allowed: false, status: 'db_not_bound' }, 500);
  await ensureSchema(env);
  const body = await request.json().catch(() => ({}));
  const key = String(body.key || body.license_key || '').trim();
  const systemSerial = String(body.system_serial || body.System_Serial || body.hwid || body.serial || '').trim();
  const deviceModel = String(body.device_model || '').trim();
  if (!key || !systemSerial) return jsonResponse({ allowed: false, status: 'bad_request' }, 400);

  const row = await getLicenseRow(env, key);
  if (!row) return jsonResponse({ allowed: false, status: 'not_found' }, 404);
  const status = normalizeStatus(row.status);
  if (status === 'revoked') return jsonResponse({ allowed: false, status: 'revoked' }, 200);
  if (isExpired(row)) return jsonResponse({ allowed: false, status: 'expired' }, 200);

  const bound = String(row.bound_serial || '').trim();
  if (bound && bound !== systemSerial) {
    return jsonResponse({ allowed: false, status: 'serial_mismatch', message: 'Device mismatch' }, 200);
  }
  if (status === 'active') await bindAndMarkUsed(env, key, systemSerial);

  const token = buildToken(row, systemSerial, deviceModel);
  const signature = await signToken(token, env);
  return jsonResponse({ allowed: true, status: 'ok', token, signature }, 200);
}

async function handleHeartbeat(request, env) {
  if (!requireAuth(request, env)) return jsonResponse({ ok: false }, 401);
  if (!env.DB) return jsonResponse({ ok: false }, 500);
  await ensureSchema(env);
  const body = await request.json().catch(() => ({}));
  const systemSerial = String(body.system_serial || body.System_Serial || '').trim();
  if (!systemSerial) return jsonResponse({ ok: false }, 400);
  await env.DB.prepare(
    "INSERT INTO machines (system_serial, device_model, last_seen_at, metadata_json) VALUES (?, ?, ?, ?) ON CONFLICT(system_serial) DO UPDATE SET device_model=excluded.device_model, last_seen_at=excluded.last_seen_at, metadata_json=excluded.metadata_json"
  )
    .bind(systemSerial, body.device_model || null, nowTs(), JSON.stringify(body.metadata || null))
    .run();
  return jsonResponse({ ok: true }, 200);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== 'POST') return jsonResponse({ error: 'Method Not Allowed' }, 405);
    if (url.pathname === '/activate') return handleActivate(request, env);
    if (url.pathname === '/validate-license') return handleValidate(request, env);
    if (url.pathname === '/heartbeat') return handleHeartbeat(request, env);
    return jsonResponse({ error: 'Not Found' }, 404);
  },
};
