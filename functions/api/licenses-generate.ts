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

  const body = (await request.json().catch(() => ({}))) as { qty?: unknown; type?: unknown; owner?: unknown };
  const qtyN = typeof body.qty === 'number' ? body.qty : Number(body.qty);
  const qty = Number.isFinite(qtyN) ? Math.max(1, Math.min(200, Math.floor(qtyN))) : 1;
  const type = typeof body.type === 'string' && body.type.trim() ? body.type.trim() : 'lifetime';
  const owner = typeof body.owner === 'string' && body.owner.trim() ? body.owner.trim() : null;

  const now = Date.now();
  const created: string[] = [];

  for (let i = 0; i < qty; i++) {
    let key = generateKey();
    for (let attempt = 0; attempt < 5; attempt++) {
      const r = await env.LICENSE_DB.prepare(
        'INSERT OR IGNORE INTO licenses (license_key, status, owner, type, expires_at, bound_serial, activated_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(key, 'active', owner, type, null, null, null, now, now).run();
      if (r.success && (r.meta?.changes || 0) > 0) break;
      key = generateKey();
    }
    created.push(key);
  }

  const rows = await env.LICENSE_DB.prepare(
    `SELECT license_key, status, owner, type, expires_at, bound_serial, activated_at, created_at, updated_at FROM licenses WHERE license_key IN (${created.map(() => '?').join(',')})`
  ).bind(...created).all();

  return json({ ok: true, licenses: rows.results || [] });
};
