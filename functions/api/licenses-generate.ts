import { requireAdmin } from './_require-admin';

type Env = {
  ADMIN_TOKEN: string;
  LICENSE_DB: D1Database;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function randomChar() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return chars[Math.floor(Math.random() * chars.length)];
}

function generateKey() {
  const part = () => Array.from({ length: 4 }, randomChar).join('');
  return `NEO-${part()}-${part()}-${part()}`;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const auth = requireAdmin(request, env);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);

  if (!env.LICENSE_DB) return json({ ok: false, error: 'license_db_not_bound' }, 500);

  const body = (await request.json().catch(() => ({}))) as { qty?: unknown; type?: unknown; owner?: unknown };
  const qtyN = typeof body.qty === 'number' ? body.qty : Number(body.qty);
  const qty = Number.isFinite(qtyN) ? Math.max(1, Math.min(200, Math.floor(qtyN))) : 1;
  const type = typeof body.type === 'string' && body.type.trim() ? body.type.trim() : 'lifetime';
  const owner = typeof body.owner === 'string' && body.owner.trim() ? body.owner.trim() : null;

  try {
    await env.LICENSE_DB.prepare(
      "CREATE TABLE IF NOT EXISTS licenses (license_key TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'active', owner TEXT, type TEXT NOT NULL DEFAULT 'lifetime', expires_at INTEGER, bound_serial TEXT, activated_at INTEGER, created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000), updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000))"
    ).run();

    const now = Date.now();
    const created: string[] = [];

    for (let i = 0; i < qty; i++) {
      let key = generateKey();
      let inserted = false;
      for (let attempt = 0; attempt < 5; attempt++) {
        const r = await env.LICENSE_DB.prepare(
          'INSERT OR IGNORE INTO licenses (license_key, status, owner, type, expires_at, bound_serial, activated_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(key, 'active', owner, type, null, null, null, now, now).run();
        if (r.success && (r.meta?.changes || 0) > 0) {
          inserted = true;
          break;
        }
        key = generateKey();
      }
      if (inserted) created.push(key);
    }

    if (created.length === 0) return json({ ok: false, error: 'failed_to_generate' }, 500);

    const rows = await env.LICENSE_DB.prepare(
      `SELECT license_key, status, owner, type, expires_at, bound_serial, activated_at, created_at, updated_at FROM licenses WHERE license_key IN (${created.map(() => '?').join(',')})`
    ).bind(...created).all();

    return json({ ok: true, licenses: rows.results || [] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e || 'db_error');
    return json({ ok: false, error: 'db_error', message }, 500);
  }
};
